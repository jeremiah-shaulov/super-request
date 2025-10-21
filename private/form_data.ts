import {RdStream} from './deps.ts';
import {SuperFile} from './super_file.ts';

const BUFFER_LEN = 32*1024; // max length for header line is BUFFER_LEN/2. an example of header line is: `Content-Disposition: form-data; name="image"; filename="/tmp/current_file"`
const MAX_BOUNDARY_LEN = 100;
const MAX_DECORATOR_LEN = 100; // the decorator is "\r\n------" (with unspecified number of dashes) that precedes boundary

const C_EQ = '='.charCodeAt(0);
const C_COLON = ':'.charCodeAt(0);
const C_SEMICOLON = ';'.charCodeAt(0);
const C_CR = '\r'.charCodeAt(0);
const C_LF = '\n'.charCodeAt(0);
const C_SPACE = ' '.charCodeAt(0);
const C_TAB = '\t'.charCodeAt(0);
const C_QT = '"'.charCodeAt(0);
const C_BACKSLASH = '\\'.charCodeAt(0);
const C_HYPHEN = '-'.charCodeAt(0);

const encoder = new TextEncoder;

export type FormDataEntry = {name: string; value: string|SuperFile};

/**	According to: https://www.w3.org/Protocols/rfc1341/7_2_Multipart.html
 **/
export async function *parseFormData(body: RdStream, charset: string|undefined, boundary: string): AsyncGenerator<FormDataEntry, void, unknown>
{	/*	Parse:

		------------------------------b2449e94a11c
		Content-Disposition: form-data; name="user_id"

		3
		------------------------------b2449e94a11c
		Content-Disposition: form-data; name="post_id"

		5
		------------------------------b2449e94a11c
		Content-Disposition: form-data; name="image"; filename="/tmp/current_file"
		Content-Type: application/octet-stream

		Content of the file
		------------------------------b2449e94a11c--
	*/

	const buffer: Uint8Array<ArrayBufferLike> = new Uint8Array(BUFFER_LEN);
	let bufferStart = 0; // data in use is buffer[bufferStart .. bufferEnd]
	let bufferEnd = 0;
	const boundaryBytes = encoder.encode(boundary);
	using reader = body.getReader({mode: 'byob'});

	async function read(buffer: Uint8Array)
	{	const {value, done} = await reader.read(buffer.subarray(bufferEnd));
		if (done)
		{	throw new Error('Incomplete multipart body');
		}
		bufferEnd += value.byteLength;
	}

	const enum State
	{	HEADER,
		HEADER_VALUE,
	}

	const decoder = new TextDecoder(charset);
	let headerName = ''; // is valid in S_HEADER_VALUE
	let name = ''; // param name
	let filename = ''; // param filename (uploaded file)
	let contentTypeFull = ''; // uploaded file type
	let state = State.HEADER; // parser state

	if (boundaryBytes.length==0 || boundaryBytes.length>MAX_BOUNDARY_LEN)
	{	throw new Error('Invalid boundary');
	}

	// Skip anything before first boundary (it must be ignored according to RFC)
	while (true)
	{	await read(buffer);
		// Look for "boundary" followed by "\r\n"
		let i = bufferIndexOfNl(buffer, bufferEnd, boundaryBytes);
		if (i != -1)
		{	// Found first boundary followed by "\r\n"
			bufferStart = i + boundaryBytes.length + 2;
			break;
		}
		i = bufferEnd - boundaryBytes.length - (2 - 1);
		if (i > 0)
		{	buffer.copyWithin(0, i, bufferEnd);
			bufferEnd -= i;
		}
	}

	while (true)
	{	// 1. Set "i" to index of COLON, CR or LF, depending on "state"
		let i = bufferStart;
		while (true)
		{	i = state==State.HEADER ? bufferIndexOfOneOf3(buffer, i, bufferEnd, C_COLON, C_CR, C_LF) : buffer.subarray(0, bufferEnd).indexOf(C_CR, i);
			if (i != -1)
			{	break;
			}
			if ((bufferEnd-bufferStart)*2 > buffer.length)
			{	// Too few space in buffer
				if (bufferStart == 0)
				{	throw new Error('Header is too long');
				}
				buffer.copyWithin(0, bufferStart, bufferEnd);
				bufferEnd -= bufferStart;
				bufferStart = 0;
			}
			i = bufferEnd;
			await read(buffer);
		}

		// 2. Read header name or value
		if (state == State.HEADER)
		{	if (i != bufferStart)
			{	// header
				if (buffer[i] !== C_COLON)
				{	throw new Error('Invalid header'); // header name is too long, or no header name
				}
				headerName = decoder.decode(bufferTrim(buffer.subarray(bufferStart, i))).toLowerCase();
				bufferStart = i + 1; // after ':'
				state = State.HEADER_VALUE;
			}
			else
			{	// Empty line terminates headers
				if (buffer[i] !== C_CR)
				{	throw new Error('Invalid header'); // line starts with ":" or "\n"
				}
				// At "\r" that is hopefully followed by "\n"
				i++; // to "\n"
				if (i >= bufferEnd)
				{	bufferStart = bufferEnd = i = 0;
					await read(buffer);
				}
				if (buffer[i] !== C_LF)
				{	throw new Error('Invalid header'); // no "\n" follows "\r"
				}
				i++; // after "\r\n"
				bufferStart = i;
				i = -1;

				// Read body

				let scanFrom = bufferStart; // from where to start searching for boundary
				let lastPart = buffer.subarray(0, 0);
				let expectedEof = false; // if "--" found after boundary

				/**	This function fills buffer with data until boundary is found, and returns a part of buffer.
					Call it while it returns nonempty part. At the end it sets `i` to position of found boundary in buffer.
				**/
				// deno-lint-ignore no-inner-declarations
				async function readFieldPart(view?: Uint8Array)
				{	if (i != -1)
					{	if (!view)
						{	const result = lastPart;
							lastPart = lastPart.subarray(0, 0);
							return result;
						}
						else
						{	const result = lastPart.subarray(0, Math.min(lastPart.length, view.length));
							lastPart = lastPart.subarray(result.length);
							view.set(result);
							return result;
						}
					}
					let useBuffer = buffer;
					while (true)
					{	i = bufferIndexOf(useBuffer, scanFrom, bufferEnd-2, boundaryBytes); // ensure there are 2 bytes after boundary for "\r\n" or "--"
						if (i != -1)
						{	const scanDecoratorFrom = Math.max(bufferStart, scanFrom-MAX_DECORATOR_LEN);
							let endField = useBuffer.subarray(scanDecoratorFrom, i).lastIndexOf(C_CR); // actually value terminates "\r\n"+boundary
							if (endField == -1)
							{	throw new Error('Invalid multipart body'); // no "\r\n" after value and before boundary
							}
							endField += scanDecoratorFrom;
							expectedEof = useBuffer[i + boundaryBytes.length]===C_HYPHEN && useBuffer[i + boundaryBytes.length + 1]===C_HYPHEN;
							let result = useBuffer.subarray(bufferStart, endField);
							bufferStart = i + boundaryBytes.length + 2; // boundary.length + "\r\n".length; or: boundary.length + "--".length
							if (view)
							{	if (useBuffer != view)
								{	if (result.length > view.length)
									{	lastPart = result.subarray(view.length);
										result = result.subarray(0, view.length);
									}
									view.set(result);
								}
								else
								{	buffer.set(useBuffer.subarray(bufferStart, bufferEnd));
									bufferEnd -= bufferStart;
									bufferStart = 0;
								}
							}
							return result;
						}
						scanFrom = Math.max(bufferStart, bufferEnd - 2 - boundaryBytes.length);
						const canReturnTo = scanFrom - MAX_DECORATOR_LEN;
						if (view && canReturnTo-bufferStart>=view.length) // if data in buffer can fill the whole "view"
						{	// Return it without reading more
							const to = Math.min(canReturnTo, bufferStart+view.length);
							const result = useBuffer.subarray(bufferStart, to);
							bufferStart = to;
							if (useBuffer != view)
							{	view.set(result);
							}
							else
							{	buffer.set(useBuffer.subarray(bufferStart, bufferEnd));
								bufferEnd -= bufferStart;
								bufferStart = 0;
							}
							return result;
						}
						else if (bufferStart*2 > useBuffer.length) // if bufferStart is to the right of the half buffer length
						{	// Move data to the beginning of buffer
							useBuffer.copyWithin(0, bufferStart, bufferEnd);
							scanFrom -= bufferStart;
							bufferEnd -= bufferStart;
							bufferStart = 0;
						}
						else if ((canReturnTo-bufferStart)*2 >= useBuffer.length) // if data in buffer is more than half of buffer length
						{	// Return it without reading more
							const result = useBuffer.subarray(bufferStart, canReturnTo);
							bufferStart = canReturnTo;
							if (useBuffer != view)
							{	view?.set(result);
							}
							else
							{	buffer.set(useBuffer.subarray(bufferStart, bufferEnd));
								bufferEnd -= bufferStart;
								bufferStart = 0;
							}
							return result;
						}
						if (view && useBuffer!=view)
						{	view.set(useBuffer.subarray(bufferStart, bufferEnd));
							useBuffer = view;
							scanFrom -= bufferStart;
							bufferEnd -= bufferStart;
							bufferStart = 0;
						}
						await read(useBuffer);
					}
				}

				if (!filename)
				{	// Is regular field
					let value = '';
					try
					{	while (true)
						{	const part = await readFieldPart();
							if (part.length == 0)
							{	break;
							}
							value += decoder.decode(part, {stream: true});
						}
					}
					finally
					{	value += decoder.decode(); // flush
					}
					yield {name, value};
				}
				else
				{	// Is uploaded file
					let readComplete = false;

					const value = new SuperFile
					(	new RdStream
						(	{	async read(view)
								{	try
									{	const part = await readFieldPart(view);
										if (part.length == 0)
										{	readComplete = true;
										}
										return part.length;
									}
									catch (e)
									{	readComplete = true;
										await reader.cancel().catch(e2 => Promise.reject(new Error(e2 instanceof Error ? e2.message : e2+'', {cause: e})));
										throw e;
									}
								},

								async cancel()
								{	// User cancelled reading the stream
									while (!readComplete)
									{	await this.read(buffer);
									}
								},
							}
						),
						filename,
						contentTypeFull
					);

					yield {name, value};
					if (!readComplete)
					{	throw new Error('Please, read the whole file stream, or cancel it, before reading next form field');
					}
				}
				name = '';
				contentTypeFull = '';
				filename = '';
				if (expectedEof)
				{	while (true)
					{	while (bufferStart < bufferEnd)
						{	const c = buffer[bufferStart++];
							if (c!==C_CR && c!==C_LF && c!==C_SPACE && c!==C_TAB)
							{	throw new Error('Invalid data after end of multipart body');
							}
						}
						bufferStart = bufferEnd = 0;
						const {value, done} = await reader.read(buffer);
						if (done)
						{	return;
						}
						bufferEnd += value.byteLength;
					}
				}
			}
		}
		else
		{	if (headerName == 'content-disposition')
			{	let i2 = buffer.subarray(0, i).indexOf(C_SEMICOLON, bufferStart);
				if (i2 == -1)
				{	throw new Error('Invalid Content-Disposition header'); // no ';' in "Content-Disposition: form-data; ..."
				}
				// Assume: is at string like '; name="main image"; filename="/tmp/current_file"'
				while (true)
				{	while (buffer[++i2] === C_SPACE); // skip '; '
					let i3 = buffer.subarray(0, i).indexOf(C_EQ, i2);
					if (i3 == -1)
					{	break;
					}
					const field = decoder.decode(buffer.subarray(i2, i3));
					i2 = i3 + 1; // after '='
					if (buffer[i2] !== C_QT)
					{	break;
					}
					i2++; // after opening '"'
					i3 = buffer.subarray(0, i).indexOf(C_QT, i2);
					while (buffer[i3-1] === C_BACKSLASH)
					{	i3 = buffer.subarray(0, i).indexOf(C_QT, i3+1);
					}
					if (i3 == -1)
					{	break;
					}
					if (field == 'name')
					{	name = decoder.decode(buffer.subarray(i2, i3)).replaceAll('\\"', '"').replaceAll('\\\\', '\\');
					}
					else if (field == 'filename')
					{	filename = decoder.decode(buffer.subarray(i2, i3)).replaceAll('\\"', '"').replaceAll('\\\\', '\\');
					}
					i2 = i3 + 1; // after closing '"'
				}
			}
			else if (headerName == 'content-type')
			{	contentTypeFull = decoder.decode(bufferTrim(buffer.subarray(bufferStart, i)));
			}
			// At "\r" that is hopefully followed by "\n"
			i++; // to "\n"
			if (i >= bufferEnd)
			{	bufferStart = bufferEnd = i = 0;
				await read(buffer);
			}
			if (buffer[i] !== C_LF)
			{	throw new Error('Invalid header'); // no "\n" follows "\r"
			}
			i++; // after "\r\n"
			bufferStart = i;
			headerName = '';
			state = State.HEADER;
		}
	}
}

function bufferIndexOf(haystack: Uint8Array, haystackStart: number, haystackEnd: number, needle: Uint8Array)
{	const needleEnd = needle.length;
	haystackEnd -= needleEnd;
	if (haystackEnd < haystackStart)
	{	return -1;
	}
L:	for (; haystackStart<=haystackEnd; haystackStart++)
	{	for (let j=haystackStart, k=0; k<needleEnd; k++)
		{	if (haystack[j++] !== needle[k])
			{	continue L;
			}
		}
		return haystackStart;
	}
	return -1;
}

function bufferIndexOfNl(haystack: Uint8Array, haystackLen: number, needle: Uint8Array)
{	const needleEnd = needle.length;
L:	for (let i=needleEnd, iEnd=haystackLen-2; i<=iEnd; i++)
	{	if (haystack[i]!==C_CR || haystack[i+1]!==C_LF)
		{	continue;
		}
		const at = i - needleEnd;
		for (let j=at, k=0; k<needleEnd; k++)
		{	if (haystack[j++] !== needle[k])
			{	continue L;
			}
		}
		return at;
	}
	return -1;
}

function bufferIndexOfOneOf3(buffer: Uint8Array, start: number, end: number, b0: number, b1: number, b2: number)
{	while (start < end)
	{	const c = buffer[start];
		if (c===b0 || c===b1 || c===b2)
		{	return start;
		}
		start++;
	}
	return -1;
}

function bufferTrim(buffer: Uint8Array)
{	let start = 0;
	let c;
	while (start<buffer.length && ((c = buffer[start])===C_SPACE || c===C_CR || c===C_LF || c===C_TAB))
	{	start++;
	}
	let end = buffer.length;
	while (end>start && ((c = buffer[end-1])===C_SPACE || c===C_CR || c===C_LF || c===C_TAB))
	{	end--;
	}
	return buffer.subarray(start, end);
}
