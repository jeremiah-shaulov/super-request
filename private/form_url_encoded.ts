const BUFFER_LEN = 8*1024;
const REALLOC_THRESHOLD = 512;

const C_AMP = '&'.charCodeAt(0);
const C_EQ = '='.charCodeAt(0);
const C_SPACE = ' '.charCodeAt(0);
const C_PLUS = '+'.charCodeAt(0);
const C_PERCENT = '%'.charCodeAt(0);
const C_ZERO = '0'.charCodeAt(0);
const C_NINE = '9'.charCodeAt(0);
const C_A_CAP = 'A'.charCodeAt(0);
const C_F_CAP = 'F'.charCodeAt(0);
const C_A_LOW = 'a'.charCodeAt(0);

/**	Parses an application/x-www-form-urlencoded request body and yields name-value pairs.

	Handles URL-encoded data where '+' represents spaces and '%XX' represents encoded bytes.
	Yields entries in the format `{name, value}` for "name=value" pairs, or `{name}` for standalone names (not followed by `=value`).

	@param body The readable stream containing the URL-encoded body data
	@param charset The character encoding from "Content-Type" header (default: "utf-8")
 **/
export async function *parseFormUrlencoded(body: ReadableStream<Uint8Array>, charset?: string): AsyncGenerator<{name: string, value?: string}, void>
{	const enum State
	{	NAME,
		VALUE,
	}

	let buffer = new Uint8Array(BUFFER_LEN);
	const reader = body.getReader({mode: 'byob'});
	try
	{	const decoder = new TextDecoder(charset);
		let bufferStart = 0; // data in use is buffer[buffer_start .. buffer_end]
		let bufferEnd = 0;
		let name = ''; // param name read from stream (after '&' and before '='); is valid in State.VALUE
		let state = State.NAME; // parser state
		let isEof = false;

		while (true)
		{	// 1. Set "i" to index of EQ or AMP or to buffer_end in case of EOF
			let i = bufferStart;
			while (true)
			{	i = state==State.NAME ? bufferIndexOfOneOf2(buffer, i, bufferEnd, C_EQ, C_AMP) : buffer.subarray(0, bufferEnd).indexOf(C_AMP, i);
				if (i != -1)
				{	break;
				}
				// not enough data in buffer
				if (bufferEnd+REALLOC_THRESHOLD > buffer.length)
				{	// too few space in buffer
					if (bufferStart != 0)
					{	buffer.copyWithin(0, bufferStart, bufferEnd);
						bufferEnd -= bufferStart;
						bufferStart = 0;
					}
					if (bufferEnd+REALLOC_THRESHOLD > buffer.length)
					{	// realloc
						const tmp = new Uint8Array(buffer.length*2);
						tmp.set(buffer.subarray(0, bufferEnd));
						buffer = tmp;
					}
				}
				i = bufferEnd;
				const {value, done} = await reader.read(buffer.subarray(bufferEnd));
				if (done)
				{	isEof = true;
					break;
				}
				buffer = new Uint8Array(value.buffer);
				bufferEnd += value.byteLength;
			}

			// 2. Read param name (if State.NAME) or value (if State.VALUE)
			const j = decodeUriComponentInplace(buffer, bufferStart, i);
			const str = decoder.decode(buffer.subarray(bufferStart, j));
			bufferStart = i + 1; // after '=' or '&'
			if (i<bufferEnd && buffer[i]===C_EQ)
			{	name = str;
				state = State.VALUE;
			}
			else
			{	if (state == State.NAME)
				{	// case: name (without '=')
					yield {name: str};
				}
				else
				{	// case: name=value
					yield {name, value: str};
					state = State.NAME;
				}
				if (isEof)
				{	break;
				}
			}
		}
	}
	finally
	{	reader.releaseLock();
	}
}

function bufferIndexOfOneOf2(buffer: Uint8Array, start: number, end: number, b0: number, b1: number)
{	// run through all bytes
	while (start < end)
	{	const c = buffer[start];
		if (c===b0 || c===b1)
		{	return start;
		}
		start++;
	}
	return -1;
}

/**	This function does decodeURIComponent() job in-place, so it doesn't allocate memory for decoded string.
	It does even better, because deno built-in `encodeURIComponent()` can leave '+' as plus, while
	it must designate space character in `application/x-www-form-urlencoded` content.
 **/
function decodeUriComponentInplace(buffer: Uint8Array, start: number, end: number)
{	let i = start;
	while (i < end)
	{	const c = buffer[i];
		if (c == C_PLUS)
		{	buffer[start++] = C_SPACE;
			i++;
		}
		else if (c==C_PERCENT && i+2<end)
		{	i++;
			let d1 = buffer[i++];
			let d2 = buffer[i++];
			d1 = d1<=C_NINE ? d1-C_ZERO : d1<=C_F_CAP ? d1-(C_A_CAP-10) : d1-(C_A_LOW-10);
			d2 = d2<=C_NINE ? d2-C_ZERO : d2<=C_F_CAP ? d2-(C_A_CAP-10) : d2-(C_A_LOW-10);
			buffer[start++] = (d1<<4) | d2;
		}
		else
		{	buffer[start++] = buffer[i++];
		}
	}
	return start;
}
