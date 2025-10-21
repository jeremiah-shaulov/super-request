import {Iconv, RdStream} from './deps.ts';
import {parseContentType} from './content_type.ts';
import {SuperCookies} from './super_cookies.ts';
import {FormDataEntry, parseFormData} from './form_data.ts';
import {parseFormUrlencoded} from './form_url_encoded.ts';
import {SuperBlob} from './super_file.ts';
import {SearchParam, setSearchParamJson, SuperUrl} from './super_url.ts';

const encoder = new TextEncoder;
const decoder = new TextDecoder;

type ReaderSource =
{	read(view: Uint8Array): number | null | PromiseLike<number|null>;
	close?(): void | PromiseLike<void>;
};

type SuperBodyInit = BodyInit | ReaderSource;

export type SuperRequestInit = Omit<RequestInit, 'body'> & {body?: SuperBodyInit|null};

export type SuperRequestOptions =
{	lengthLimit?: number;
};

/**	@category Errors
 **/
export class TooBigError extends Error
{
}

/**	This class extends the standard Request class to add additional features.
	It can be constructed from an existing Request object or any other way like the standard Request.
	It also supports `Reader` body type in the constructor (objects that have a `read(buffer)` method, like `Deno.FsFile`).
	Such body type is more efficient, because it doesn't require copying data into intermediate buffers.

	The additional features are:
	- Maximum request body size limit, configurable via the {@link SuperRequestOptions.lengthLimit lengthLimit} option.
	If the request body exceeds this limit, the body stream is cancelled, and a {@link TooBigError} is thrown.
	- {@link urlUrl} property: a {@link SuperUrl} object representing the request URL.
	- {@link type} and {@link charset} properties: parsed values from the "Content-Type" header.
	- {@link cookies} property: a {@link SuperCookies} object representing the cookies in the "Cookie" header. You can add, modify, and delete cookies, and then apply the changes to a `Response` object.
	- {@link files()} method: an async generator that yields files from a "multipart/form-data" request body. The file streams are not kept in memory, and you need to consume or cancel each file stream during the iteration.
	- {@link formData()} method behaves differently than the standard `Request`: it returns a `FormData` object that includes only non-file fields from a "multipart/form-data" body. File fields are skipped. If you're interested in files, call the {@link files()} method before calling {@link formData()} to handle the files.
	- {@link json()} method: parses the request body as JSON. Unlike the standard `Request`, it can also parse "multipart/form-data" and "application/x-www-form-urlencoded" bodies into a JavaScript object. The parsing rules are the same as for {@link SuperUrl} search parameters, supporting arrays and nested objects.
 **/
export class SuperRequest extends Request
{	#bodyInit: SuperBodyInit|null;
	#lengthLimit;
	#bodyUsed = false;
	#urlUrl: SuperUrl|undefined;
	#type: string|undefined;
	#charset: string|undefined;
	#boundary: string|undefined;
	#cookies: SuperCookies|undefined;

	/**	State 0: !#bodyJson && !#bodyIterator - haven't read "multipart/form-data" body yet
		State 1: #bodyJson && #bodyIterator - in the middle of reading "multipart/form-data" body
		State 2: #bodyJson && !#bodyIterator - read all "multipart/form-data" body
	 **/
	#bodyJson: Record<string, SearchParam> | undefined;
	#bodyIterator: AsyncGenerator<FormDataEntry, void, unknown> | undefined;
	#formDataIterator: Iterator<[string, FormDataEntryValue]> | undefined;

	#bodyFormData: FormData|undefined;

	constructor(input: RequestInfo, init?: SuperRequestInit, options?: SuperRequestOptions)
	{	super(input, !init?.body ? init as RequestInit : {...init, body: null});
		this.#bodyInit = init?.body ?? (typeof(input)=='string' ? null : input.body);
		this.#lengthLimit = options?.lengthLimit ?? Number.MAX_SAFE_INTEGER;
	}

	override get body()
	{	return this.#bodyInit==null ? null : this.#getBodyStream() as ReadableStream<Uint8Array<ArrayBuffer>>;
	}

	override get bodyUsed()
	{	return this.#bodyUsed;
	}

	get urlUrl()
	{	if (!this.#urlUrl)
		{	this.#urlUrl = new SuperUrl(this.url, 'http://localhost');
		}
		return this.#urlUrl;
	}

	/**	MIME type in lowercase, without parameters. E.g. "text/html" or "application/json".
		Empty string if "Content-Type" header is not present.
	 **/
	get type()
	{	return this.#parseContentType();
	}

	/**	Charset from "Content-Type" header, e.g. "utf-8".
	 **/
	get charset()
	{	this.#parseContentType();
		return this.#charset;
	}

	get cookies()
	{	if (!this.#cookies)
		{	this.#cookies = new SuperCookies(this.headers.get('cookie'));
		}
		return this.#cookies;
	}

	#getBodyStream()
	{	let lengthLimit = this.#lengthLimit;
		const bodyInit = this.#bodyInit;
		if (bodyInit instanceof ReadableStream || bodyInit instanceof Blob || bodyInit instanceof FormData)
		{	let bodyStream: ReadableStream<Uint8Array> | undefined;

			let reader: ReadableStreamBYOBReader|undefined;
			let readBuffer: Uint8Array|undefined;

			return new RdStream
			(	{	read: async buffer =>
					{	bodyStream ??=
						(	bodyInit instanceof ReadableStream ?
								bodyInit :
							bodyInit instanceof Blob ?
								bodyInit.stream() :
								new Request(this.url, {method: this.method, headers: this.headers, body: bodyInit}).body!
						);
						this.#bodyUsed = true;
						if (!reader)
						{	try
							{	reader = bodyStream.getReader({mode: 'byob'});
							}
							catch
							{	bodyStream = RdStream.from(bodyStream);
								reader = bodyStream.getReader({mode: 'byob'});
							}
						}

						if (!readBuffer || readBuffer.byteLength<buffer.byteLength)
						{	readBuffer = new Uint8Array(buffer.buffer.byteLength);
						}
						const {value, done} = await reader.read(readBuffer.subarray(0, buffer.byteLength));
						if (done || !value)
						{	return 0;
						}
						readBuffer = new Uint8Array(value.buffer);
						lengthLimit -= value.byteLength;
						if (lengthLimit < 0)
						{	const e = new Error('Request body is too large');
							await reader.cancel().catch(e2 => Promise.reject(new Error(e2 instanceof Error ? e2.message : e2+'', {cause: e})));
							throw e;
						}
						buffer.set(value);
						return value.byteLength;
					},

					cancel: reason =>
					{	bodyStream ??=
						(	bodyInit instanceof ReadableStream ?
								bodyInit :
							bodyInit instanceof Blob ?
								bodyInit.stream() :
								new Request(this.url, {method: this.method, headers: this.headers, body: bodyInit}).body!
						);
						return (reader ?? bodyStream).cancel(reason);
					},

					finally: () =>
					{	reader?.releaseLock();
						readBuffer = undefined;
						this.#bodyIterator = undefined;
						this.#boundary = undefined;
					}
				}
			);
		}
		else if (bodyInit==null || typeof(bodyInit)=='string' || bodyInit instanceof URLSearchParams || bodyInit instanceof ArrayBuffer || ArrayBuffer.isView(bodyInit))
		{	let data =
				bodyInit==null ?
					new Uint8Array :
				typeof(bodyInit)=='string' ?
					(!this.#charset ? encoder.encode(bodyInit) : Iconv.encode(bodyInit, this.#charset)) :
				bodyInit instanceof URLSearchParams ?
					encoder.encode(bodyInit+'') :
				bodyInit instanceof ArrayBuffer ?
					new Uint8Array(bodyInit) :
					new Uint8Array(bodyInit.buffer, bodyInit.byteOffset, bodyInit.byteLength);

			this.#bodyUsed = bodyInit != null;

			if (data.byteLength > lengthLimit)
			{	throw new TooBigError('Request body is too large');
			}

			return new RdStream
			(	{	read(buffer)
					{	const n = Math.min(buffer.byteLength, data.byteLength);
						buffer.set(data.subarray(0, n));
						data = data.subarray(n);
						return n;
					}
				}
			);
		}
		else if ('read' in bodyInit)
		{	return new RdStream
			(	{	read: async buffer =>
					{	this.#bodyUsed = true;
						const n = await bodyInit.read(buffer);
						if (n)
						{	lengthLimit -= n;
							if (lengthLimit < 0)
							{	throw new TooBigError('Request body is too large');
							}
						}
						return n;
					},
					finally()
					{	return bodyInit?.close?.();
					}
				}
			);
		}
		else
		{	const bodyInit2 = bodyInit;
			const useBody = () => this.#bodyUsed = true;
			// deno-lint-ignore no-inner-declarations
			async function *it()
			{	useBody();
				for await (const chunk of bodyInit2)
				{	lengthLimit -= chunk.byteLength;
					if (lengthLimit < 0)
					{	throw new TooBigError('Request body is too large');
					}
					yield chunk;
				}
			}
			return RdStream.from(it());
		}
	}

	#parseContentType()
	{	if (this.#type == undefined)
		{	const contentTypeFull = this.headers.get('content-type');
			if (contentTypeFull)
			{	const {type, charset, boundary} = parseContentType(contentTypeFull);
				this.#type = type.toLowerCase();
				this.#charset = charset;
				if (this.#type == 'multipart/form-data')
				{	this.#boundary = boundary;
				}
			}
			else
			{	this.#type = '';
			}
		}
		return this.#type;
	}

	async *files()
	{	this.#bodyUsed = this.#bodyInit != null;
		while (true)
		{	const file = await this.#nextFile();
			if (!file)
			{	break;
			}
			yield file;
		}
	}

	async #nextFile(): Promise<{name: string; value: File} | undefined>
	{	if (this.#bodyInit instanceof FormData)
		{	this.#bodyUsed = true;
			this.#bodyJson ??= {}; // currently it's not known what method the user will call: formData() or json(), so ne prepared for both
			this.#bodyFormData ??= new FormData;
			this.#formDataIterator ??= this.#bodyInit.entries();
			while (true)
			{	const {value: item, done} = this.#formDataIterator.next();
				if (done)
				{	this.#formDataIterator = undefined;
					break;
				}
				const [name, value] = item;
				if (value instanceof File)
				{	return {name, value};
				}
				else
				{	setSearchParamJson(this.#bodyJson, name, value);
					this.#bodyFormData.append(name, value);
				}
			}
		}
		else if (this.#bodyInit!=null && !(this.#bodyInit instanceof URLSearchParams))
		{	this.#parseContentType();
			if (this.#boundary)
			{	this.#bodyUsed = true;
				if (!this.#bodyJson)
				{	this.#bodyJson = {};
					this.#bodyIterator = parseFormData(this.#getBodyStream(), this.#charset, this.#boundary);
				}
				this.#bodyFormData ??= new FormData; // currently it's not known what method the user will call: formData() or json(), so ne prepared for both
				if (this.#bodyIterator)
				{	while (true)
					{	const {value: entry, done} = await this.#bodyIterator.next();
						if (done)
						{	this.#bodyIterator = undefined;
							break;
						}
						const {name, value} = entry;
						if (typeof(value) != 'string')
						{	return {name, value};
						}
						setSearchParamJson(this.#bodyJson, name, value);
						this.#bodyFormData.append(name, value);
					}
				}
			}
		}
	}

	override async json()
	{	if (this.#bodyInit instanceof FormData || this.#bodyInit instanceof URLSearchParams)
		{	this.#bodyUsed = true;
			const obj: Record<string, string> = {};
			for (const [name, value] of this.#bodyInit)
			{	if (typeof(value) == 'string')
				{	setSearchParamJson(obj, name, value);
				}
			}
			return obj;
		}
		else if (this.#bodyInit != null)
		{	this.#bodyUsed = true;
			try
			{	this.#parseContentType();
				if (this.#boundary)
				{	if (!this.#bodyJson)
					{	this.#bodyJson = {};
						this.#bodyIterator = parseFormData(this.#getBodyStream(), this.#charset, this.#boundary);
					}
					const obj = this.#bodyJson;
					if (this.#bodyIterator)
					{	while (true)
						{	const {value, done} = await this.#bodyIterator.next();
							if (done)
							{	break;
							}
							if (typeof(value.value) != 'string')
							{	await value.value.stream().cancel();
							}
							else
							{	setSearchParamJson(obj, value.name, value.value);
							}
						}
					}
					return obj;
				}
				else if (this.#type == 'application/x-www-form-urlencoded')
				{	const obj: Record<string, SearchParam> = {};
					for await (const {name, value} of parseFormUrlencoded(this.#getBodyStream(), this.#charset))
					{	setSearchParamJson(obj, name, value ?? '');
					}
					return obj;
				}
				else if (this.#bodyJson)
				{	return this.#bodyJson;
				}
				else
				{	// Interpret body as JSON, regardless of Content-Type
					const body = this.#getBodyStream();
					const text = await body.text(this.#charset);
					return JSON.parse(text);
				}
			}
			finally
			{	this.#bodyJson = undefined;
				this.#bodyFormData = undefined;
			}
		}
	}

	override async formData()
	{	if (this.#bodyInit instanceof FormData || this.#bodyInit instanceof URLSearchParams)
		{	this.#bodyUsed = true;
			const obj = new FormData;
			for (const [name, value] of this.#bodyInit)
			{	if (typeof(value) == 'string')
				{	obj.append(name, value);
				}
			}
			return obj;
		}
		else if (this.#bodyInit != null)
		{	this.#bodyUsed = true;
			try
			{	this.#parseContentType();
				if (this.#boundary)
				{	if (!this.#bodyFormData)
					{	this.#bodyFormData = new FormData;
						this.#bodyIterator = parseFormData(this.#getBodyStream(), this.#charset, this.#boundary);
					}
					const obj = this.#bodyFormData;
					if (this.#bodyIterator)
					{	while (true)
						{	const {value, done} = await this.#bodyIterator.next();
							if (done)
							{	break;
							}
							if (typeof(value.value) != 'string')
							{	await value.value.stream().cancel();
							}
							else
							{	obj.append(value.name, value.value);
							}
						}
					}
					return obj;
				}
				else if (this.#type == 'application/x-www-form-urlencoded')
				{	const obj = new FormData;
					for await (const {name, value} of parseFormUrlencoded(this.#getBodyStream(), this.#charset))
					{	obj.append(name, value ?? '');
					}
					return obj;
				}
				else if (this.#bodyFormData)
				{	return this.#bodyFormData;
				}
			}
			finally
			{	this.#bodyJson = undefined;
				this.#bodyFormData = undefined;
			}
		}
		return new FormData;
	}

	override bytes(): Promise<Uint8Array<ArrayBuffer>>
	{	const bodyInit = this.#bodyInit;
		if (bodyInit == null)
		{	return Promise.resolve(new Uint8Array);
		}
		this.#bodyUsed = true;
		if (typeof(bodyInit) == 'string')
		{	const encoded = Iconv.encode(bodyInit, this.#charset || 'utf-8') as Uint8Array<ArrayBuffer>;
			if (encoded.byteLength > this.#lengthLimit)
			{	throw new TooBigError('Request body is too large');
			}
			return Promise.resolve(encoded);
		}
		if (bodyInit instanceof URLSearchParams)
		{	const encoded = encoder.encode(bodyInit+'');
			if (encoded.byteLength > this.#lengthLimit)
			{	throw new TooBigError('Request body is too large');
			}
			return Promise.resolve(encoded);
		}
		if (bodyInit instanceof ArrayBuffer)
		{	if (bodyInit.byteLength > this.#lengthLimit)
			{	throw new TooBigError('Request body is too large');
			}
			return Promise.resolve(new Uint8Array(bodyInit));
		}
		if (ArrayBuffer.isView(bodyInit))
		{	if (bodyInit.byteLength > this.#lengthLimit)
			{	throw new TooBigError('Request body is too large');
			}
			return Promise.resolve(new Uint8Array(bodyInit.buffer, bodyInit.byteOffset, bodyInit.byteLength));
		}
		const body = this.#getBodyStream();
		return body.bytes();
	}

	override async arrayBuffer(): Promise<ArrayBuffer>
	{	const bodyInit = this.#bodyInit;
		if (bodyInit == null)
		{	return Promise.resolve(new ArrayBuffer);
		}
		this.#bodyUsed = true;
		const body = this.#getBodyStream();
		const data = await body.bytes();
		if (data.byteOffset==0 && data.byteLength==data.buffer.byteLength)
		{	return data.buffer;
		}
		return data.buffer.slice(data.byteOffset, data.byteOffset+data.byteLength);
	}

	override text()
	{	const bodyInit = this.#bodyInit;
		if (bodyInit == null)
		{	return Promise.resolve('');
		}
		this.#bodyUsed = true;
		if (typeof(bodyInit) == 'string')
		{	if (encoder.encode(bodyInit).length > this.#lengthLimit)
			{	throw new TooBigError('Request body is too large');
			}
			return Promise.resolve(bodyInit);
		}
		if (bodyInit instanceof URLSearchParams)
		{	const str = bodyInit+'';
			if (encoder.encode(str).length > this.#lengthLimit)
			{	throw new TooBigError('Request body is too large');
			}
			return Promise.resolve(str);
		}
		// Parse content type to get charset
		this.#parseContentType();
		if (bodyInit instanceof ArrayBuffer)
		{	if (bodyInit.byteLength > this.#lengthLimit)
			{	throw new TooBigError('Request body is too large');
			}
			return Promise.resolve(!this.#charset ? decoder.decode(bodyInit) : Iconv.decode(new Uint8Array(bodyInit), this.#charset));
		}
		if (ArrayBuffer.isView(bodyInit))
		{	const view = new Uint8Array(bodyInit.buffer, bodyInit.byteOffset, bodyInit.byteLength);
			if (view.byteLength > this.#lengthLimit)
			{	throw new TooBigError('Request body is too large');
			}
			return Promise.resolve(!this.#charset ? decoder.decode(view) : Iconv.decode(view, this.#charset));
		}
		const body = this.#getBodyStream();
		return body.text(this.#charset);
	}

	override blob()
	{	this.#bodyUsed = this.#bodyInit != null;
		const body = this.#getBodyStream();
		return Promise.resolve(new SuperBlob(body, this.type));
	}
}
