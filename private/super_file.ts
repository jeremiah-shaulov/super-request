import {RdStream} from './deps.ts';
import {parseContentType} from './content_type.ts';

/**	A Blob implementation that uses a ReadableStream as the data source.
 **/
export class SuperBlob extends Blob
{	#body;

	constructor(body: RdStream | ReadableStream<Uint8Array<ArrayBuffer>>, type: string)
	{	super(undefined, {type});
		this.#body = body;
	}

	override stream()
	{	return this.#body as ReadableStream<Uint8Array<ArrayBuffer>>;
	}

	override async arrayBuffer()
	{	const body = 'getReaderWhenReady' in this.#body ? this.#body : RdStream.from(this.#body);
		const data = await body.bytes();
		if (data.byteLength == data.buffer.byteLength)
		{	return data.buffer;
		}
		else
		{	return data.slice().buffer;
		}
	}

	override bytes()
	{	const body = 'getReaderWhenReady' in this.#body ? this.#body : RdStream.from(this.#body);
		return body.bytes();
	}

	override text()
	{	const {charset} = parseContentType(this.type);
		const body = 'getReaderWhenReady' in this.#body ? this.#body : RdStream.from(this.#body);
		return body.text(charset);
	}

	override slice(start?: number, end?: number, contentType?: string)
	{	const body = 'getReaderWhenReady' in this.#body ? this.#body : RdStream.from(this.#body);
		return blobSlice(body, start ?? 0, end ?? Number.MAX_SAFE_INTEGER, contentType ?? this.type);
	}
}

/**	A File implementation that uses a ReadableStream as the data source.
 **/
export class SuperFile extends File
{	#body;

	constructor(body: RdStream | ReadableStream<Uint8Array<ArrayBuffer>>, filename: string, type: string)
	{	super([], filename, {type});
		this.#body = body;
	}

	override stream()
	{	return this.#body as ReadableStream<Uint8Array<ArrayBuffer>>;
	}

	override async arrayBuffer()
	{	const body = 'getReaderWhenReady' in this.#body ? this.#body : RdStream.from(this.#body);
		const data = await body.bytes();
		if (data.byteLength == data.buffer.byteLength)
		{	return data.buffer;
		}
		else
		{	return data.slice().buffer;
		}
	}

	override bytes()
	{	const body = 'getReaderWhenReady' in this.#body ? this.#body : RdStream.from(this.#body);
		return body.bytes();
	}

	override text()
	{	const {charset} = parseContentType(this.type);
		const body = 'getReaderWhenReady' in this.#body ? this.#body : RdStream.from(this.#body);
		return body.text(charset);
	}

	override slice(start?: number, end?: number, contentType?: string)
	{	const body = 'getReaderWhenReady' in this.#body ? this.#body : RdStream.from(this.#body);
		return blobSlice(body, start ?? 0, end ?? Number.MAX_SAFE_INTEGER, contentType ?? this.type);
	}
}

function blobSlice(body: RdStream, start: number, end: number, contentType: string)
{	if (start >= end)
	{	return new SuperBlob(new RdStream({read() {return 0}}), contentType);
	}
	if (start<0 || end<0)
	{	throw new RangeError('This class supports only non-negative "start" and "end"');
	}
	let reader: ReadableStreamBYOBReader|undefined;
	let bytesRead = 0;
	return new SuperBlob
	(	new RdStream
		(	{	async read(view)
				{	reader ??= body.getReader({mode: 'byob'});
					if (bytesRead >= end)
					{	await reader.cancel();
						return 0;
					}
					// Skip data until "start"
					while (bytesRead < start)
					{	const {value, done} = await reader.read(view.subarray(0, start-bytesRead));
						if (done)
						{	return 0;
						}
						bytesRead += value.byteLength;
					}
					// Read data until "end"
					const {value, done} = await reader.read(view.subarray(0, end-bytesRead));
					if (done)
					{	return 0;
					}
					bytesRead += value.byteLength;
					return value.byteLength;
				},

				cancel()
				{	return (reader ?? body).cancel();
				},
			}
		),
		contentType,
	);
}
