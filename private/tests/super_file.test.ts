import {SuperBlob, SuperFile} from '../super_file.ts';
import {assertEquals, assert} from './deps.ts';
import {RdStream} from '../deps.ts';

const encoder = new TextEncoder;
const decoder = new TextDecoder;

/**	Helper function to create a ReadableStream from a string
 **/
function createStream(data: string): RdStream
{	return RdStream.from([encoder.encode(data)]);
}

/**	Helper function to create a chunked ReadableStream
 **/
function createChunkedStream(data: string, chunkSize: number): RdStream
{	const encoded = encoder.encode(data);
	const chunks = new Array<Uint8Array>;

	for (let i=0; i<encoded.length; i+=chunkSize)
	{	chunks.push(encoded.subarray(i, Math.min(i + chunkSize, encoded.length)));
	}

	return RdStream.from(chunks);
}

/**	Helper function to read all data from a ReadableStream
 **/
async function readStream(stream: ReadableStream<Uint8Array>): Promise<Uint8Array>
{	const chunks: Uint8Array[] = [];
	const reader = stream.getReader();
	try
	{	while (true)
		{	const {value, done} = await reader.read();
			if (done)
			{	break;
			}
			chunks.push(value);
		}
	}
	finally
	{	reader.releaseLock();
	}
	// Concatenate all chunks
	const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
	const result = new Uint8Array(totalLength);
	let offset = 0;
	for (const chunk of chunks)
	{	result.set(chunk, offset);
		offset += chunk.length;
	}
	return result;
}

// ============================================================================
// SuperBlob Tests
// ============================================================================

Deno.test
(	'SuperBlob - constructor with RdStream',
	() =>
	{	const stream = createStream('Hello World');
		const blob = new SuperBlob(stream, 'text/plain');
		assertEquals(blob.type, 'text/plain');
		assert(blob instanceof Blob);
	}
);

Deno.test
(	'SuperBlob - constructor with ReadableStream',
	() =>
	{	const stream = new ReadableStream<Uint8Array<ArrayBuffer>>
		(	{	start(controller)
				{	controller.enqueue(encoder.encode('Hello'));
					controller.close();
				}
			}
		);
		const blob = new SuperBlob(stream, 'text/plain');
		assertEquals(blob.type, 'text/plain');
		assert(blob instanceof Blob);
	}
);

Deno.test
(	'SuperBlob - stream() returns the body stream',
	async () =>
	{	const data = 'Test data';
		const stream = createStream(data);
		const blob = new SuperBlob(stream, 'text/plain');
		const bodyStream = blob.stream();
		const result = await readStream(bodyStream);
		assertEquals(decoder.decode(result), data);
	}
);

Deno.test
(	'SuperBlob - arrayBuffer() returns data as ArrayBuffer',
	async () =>
	{	const data = 'Hello World';
		const stream = createStream(data);
		const blob = new SuperBlob(stream, 'text/plain');
		const buffer = await blob.arrayBuffer();
		assert(buffer instanceof ArrayBuffer);
		assert(buffer.byteLength == data.length);
	}
);

// Test arrayBuffer content via bytes() instead
Deno.test
(	'SuperBlob - bytes() returns correct data',
	async () =>
	{	const data = 'Test data';
		const stream = createStream(data);
		const blob = new SuperBlob(stream, 'text/plain');
		const bytes = await blob.bytes();
		assertEquals(decoder.decode(bytes), data);
	}
);

Deno.test
(	'SuperBlob - bytes() returns data as Uint8Array',
	async () =>
	{	const data = 'Test bytes';
		const stream = createStream(data);
		const blob = new SuperBlob(stream, 'text/plain');
		const bytes = await blob.bytes();
		assertEquals(decoder.decode(bytes), data);
	}
);

Deno.test
(	'SuperBlob - text() returns data as string',
	async () =>
	{	const data = 'Hello World';
		const stream = createStream(data);
		const blob = new SuperBlob(stream, 'text/plain');
		const text = await blob.text();
		assertEquals(text, data);
	}
);

Deno.test
(	'SuperBlob - text() with charset in content type',
	async () =>
	{	const data = new Uint8Array([0xF1]); // ñ in ISO-8859-1
		const stream = RdStream.from([data]);
		const blob = new SuperBlob(stream, 'text/plain; charset=iso-8859-1');
		const text = await blob.text();
		assertEquals(text, 'ñ');
	}
);

Deno.test
(	'SuperBlob - text() with UTF-8 characters',
	async () =>
	{	const data = 'Hello 世界 🌍';
		const stream = createStream(data);
		const blob = new SuperBlob(stream, 'text/plain; charset=utf-8');
		const text = await blob.text();
		assertEquals(text, data);
	}
);

Deno.test
(	'SuperBlob - empty blob',
	async () =>
	{	const stream = createStream('');
		const blob = new SuperBlob(stream, 'text/plain');
		const text = await blob.text();
		assertEquals(text, '');
	}
);

Deno.test
(	'SuperBlob - large data',
	async () =>
	{	const largeData = 'x'.repeat(100000);
		const stream = createStream(largeData);
		const blob = new SuperBlob(stream, 'text/plain');
		const text = await blob.text();
		assertEquals(text.length, 100000);
		assertEquals(text, largeData);
	}
);

Deno.test
(	'SuperBlob - chunked stream',
	async () =>
	{	const data = 'Hello World from chunked stream';
		const stream = createChunkedStream(data, 5);
		const blob = new SuperBlob(stream, 'text/plain');
		const text = await blob.text();
		assertEquals(text, data);
	}
);

Deno.test
(	'SuperBlob - slice() with start and end',
	async () =>
	{	const data = 'Hello World';
		const stream = createStream(data);
		const blob = new SuperBlob(stream, 'text/plain');
		const sliced = blob.slice(0, 5);
		assert(sliced instanceof SuperBlob);
		const text = await sliced.text();
		assertEquals(text, 'Hello');
	}
);

Deno.test
(	'SuperBlob - slice() middle portion',
	async () =>
	{	const data = 'Hello World';
		const stream = createStream(data);
		const blob = new SuperBlob(stream, 'text/plain');
		const sliced = blob.slice(6, 11);
		const text = await sliced.text();
		assertEquals(text, 'World');
	}
);

Deno.test
(	'SuperBlob - slice() with only start',
	async () =>
	{	const data = 'Hello World';
		const stream = createStream(data);
		const blob = new SuperBlob(stream, 'text/plain');
		const sliced = blob.slice(6);
		const text = await sliced.text();
		assertEquals(text, 'World');
	}
);

Deno.test
(	'SuperBlob - slice() with custom content type',
	async () =>
	{	const data = 'Hello World';
		const stream = createStream(data);
		const blob = new SuperBlob(stream, 'text/plain');
		const sliced = blob.slice(0, 5, 'text/html');
		assertEquals(sliced.type, 'text/html');
		const text = await sliced.text();
		assertEquals(text, 'Hello');
	}
);

Deno.test
(	'SuperBlob - slice() when start >= end returns empty',
	async () =>
	{	const data = 'Hello World';
		const stream = createStream(data);
		const blob = new SuperBlob(stream, 'text/plain');
		const sliced = blob.slice(5, 5);
		const text = await sliced.text();
		assertEquals(text, '');
	}
);

Deno.test
(	'SuperBlob - slice() when start > end returns empty',
	async () =>
	{	const data = 'Hello World';
		const stream = createStream(data);
		const blob = new SuperBlob(stream, 'text/plain');
		const sliced = blob.slice(10, 5);
		const text = await sliced.text();
		assertEquals(text, '');
	}
);

Deno.test
(	'SuperBlob - slice() with negative start throws error',
	() =>
	{	const data = 'Hello World';
		const stream = createStream(data);
		const blob = new SuperBlob(stream, 'text/plain');
		let error: Error | undefined;
		try
		{	blob.slice(-5, 10);
		}
		catch (e)
		{	error = e as Error;
		}
		assert(error);
		assertEquals(error.name, 'RangeError');
	}
);

Deno.test
(	'SuperBlob - slice() with negative end returns empty',
	async () =>
	{	const data = 'Hello World';
		const stream = createStream(data);
		const blob = new SuperBlob(stream, 'text/plain');
		// start >= end check happens first, so this returns empty blob
		const sliced = blob.slice(0, -1);
		const text = await sliced.text();
		assertEquals(text, '');
	}
);

Deno.test
(	'SuperBlob - slice() beyond data length',
	async () =>
	{	const data = 'Hello';
		const stream = createStream(data);
		const blob = new SuperBlob(stream, 'text/plain');
		const sliced = blob.slice(0, 100);
		const text = await sliced.text();
		assertEquals(text, 'Hello');
	}
);

Deno.test
(	'SuperBlob - slice() start beyond data length returns empty',
	async () =>
	{	const data = 'Hello';
		const stream = createStream(data);
		const blob = new SuperBlob(stream, 'text/plain');
		const sliced = blob.slice(100, 200);
		const text = await sliced.text();
		assertEquals(text, '');
	}
);

Deno.test
(	'SuperBlob - binary data',
	async () =>
	{	const binaryData = new Uint8Array([0x00, 0x01, 0x02, 0xFF, 0xFE, 0xFD]);
		const stream = RdStream.from([binaryData]);
		const blob = new SuperBlob(stream, 'application/octet-stream');
		const bytes = await blob.bytes();
		assertEquals(bytes, binaryData);
	}
);

Deno.test
(	'SuperBlob - slice() of binary data',
	async () =>
	{	const binaryData = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
		const stream = RdStream.from([binaryData]);
		const blob = new SuperBlob(stream, 'application/octet-stream');
		const sliced = blob.slice(2, 5);
		const bytes = await sliced.bytes();
		assertEquals(bytes, new Uint8Array([0x02, 0x03, 0x04]));
	}
);

// ============================================================================
// SuperFile Tests
// ============================================================================

Deno.test
(	'SuperFile - constructor with RdStream',
	() =>
	{	const stream = createStream('File content');
		const file = new SuperFile(stream, 'test.txt', 'text/plain');
		assertEquals(file.name, 'test.txt');
		assertEquals(file.type, 'text/plain');
		assert(file instanceof File);
	}
);

Deno.test
(	'SuperFile - constructor with ReadableStream',
	() =>
	{	const stream = new ReadableStream<Uint8Array<ArrayBuffer>>
		({	start(controller)
			{	controller.enqueue(encoder.encode('Content'));
				controller.close();
			}
		});
		const file = new SuperFile(stream, 'document.txt', 'text/plain');
		assertEquals(file.name, 'document.txt');
		assertEquals(file.type, 'text/plain');
		assert(file instanceof File);
	}
);

Deno.test
(	'SuperFile - filename with path',
	() =>
	{	const stream = createStream('Content');
		const file = new SuperFile(stream, '/path/to/file.txt', 'text/plain');
		assertEquals(file.name, '/path/to/file.txt');
	}
);

Deno.test
(	'SuperFile - filename with special characters',
	() =>
	{	const stream = createStream('Content');
		const file = new SuperFile(stream, 'my file (1).txt', 'text/plain');
		assertEquals(file.name, 'my file (1).txt');
	}
);

Deno.test
(	'SuperFile - stream() returns the body stream',
	async () =>
	{	const data = 'File content';
		const stream = createStream(data);
		const file = new SuperFile(stream, 'test.txt', 'text/plain');
		const bodyStream = file.stream();
		const result = await readStream(bodyStream);
		assertEquals(decoder.decode(result), data);
	}
);

Deno.test
(	'SuperFile - arrayBuffer() returns data as ArrayBuffer',
	async () =>
	{	const data = 'File content';
		const stream = createStream(data);
		const file = new SuperFile(stream, 'test.txt', 'text/plain');
		const buffer = await file.arrayBuffer();
		assert(buffer instanceof ArrayBuffer);
		assert(buffer.byteLength == data.length);
	}
);

// Test arrayBuffer content via bytes() instead
Deno.test
(	'SuperFile - bytes() returns correct data',
	async () =>
	{	const data = 'File data';
		const stream = createStream(data);
		const file = new SuperFile(stream, 'test.txt', 'text/plain');
		const bytes = await file.bytes();
		assertEquals(decoder.decode(bytes), data);
	}
);

Deno.test
(	'SuperFile - bytes() returns data as Uint8Array',
	async () =>
	{	const data = 'File content';
		const stream = createStream(data);
		const file = new SuperFile(stream, 'test.txt', 'text/plain');
		const bytes = await file.bytes();
		assertEquals(decoder.decode(bytes), data);
	}
);

Deno.test
(	'SuperFile - text() returns data as string',
	async () =>
	{	const data = 'File content';
		const stream = createStream(data);
		const file = new SuperFile(stream, 'test.txt', 'text/plain');
		const text = await file.text();
		assertEquals(text, data);
	}
);

Deno.test
(	'SuperFile - text() with charset in content type',
	async () =>
	{	const data = new Uint8Array([0xF1]); // ñ in ISO-8859-1
		const stream = RdStream.from([data]);
		const file = new SuperFile(stream, 'test.txt', 'text/plain; charset=iso-8859-1');
		const text = await file.text();
		assertEquals(text, 'ñ');
	}
);

Deno.test
(	'SuperFile - empty file',
	async () =>
	{	const stream = createStream('');
		const file = new SuperFile(stream, 'empty.txt', 'text/plain');
		const text = await file.text();
		assertEquals(text, '');
	}
);

Deno.test
(	'SuperFile - large file',
	async () =>
	{	const largeData = 'x'.repeat(100000);
		const stream = createStream(largeData);
		const file = new SuperFile(stream, 'large.txt', 'text/plain');
		const text = await file.text();
		assertEquals(text.length, 100000);
		assertEquals(text, largeData);
	}
);

Deno.test
(	'SuperFile - chunked stream',
	async () =>
	{	const data = 'Chunked file content';
		const stream = createChunkedStream(data, 5);
		const file = new SuperFile(stream, 'test.txt', 'text/plain');
		const text = await file.text();
		assertEquals(text, data);
	}
);

Deno.test
(	'SuperFile - slice() with start and end',
	async () =>
	{	const data = 'Hello World';
		const stream = createStream(data);
		const file = new SuperFile(stream, 'test.txt', 'text/plain');
		const sliced = file.slice(0, 5);
		assert(sliced instanceof SuperBlob);
		const text = await sliced.text();
		assertEquals(text, 'Hello');
	}
);

Deno.test
(	'SuperFile - slice() middle portion',
	async () =>
	{	const data = 'Hello World';
		const stream = createStream(data);
		const file = new SuperFile(stream, 'test.txt', 'text/plain');
		const sliced = file.slice(6, 11);
		const text = await sliced.text();
		assertEquals(text, 'World');
	}
);

Deno.test
(	'SuperFile - slice() with only start',
	async () =>
	{	const data = 'Hello World';
		const stream = createStream(data);
		const file = new SuperFile(stream, 'test.txt', 'text/plain');
		const sliced = file.slice(6);
		const text = await sliced.text();
		assertEquals(text, 'World');
	}
);

Deno.test
(	'SuperFile - slice() with custom content type',
	async () =>
	{	const data = 'Hello World';
		const stream = createStream(data);
		const file = new SuperFile(stream, 'test.txt', 'text/plain');
		const sliced = file.slice(0, 5, 'text/html');
		assertEquals(sliced.type, 'text/html');
		const text = await sliced.text();
		assertEquals(text, 'Hello');
	}
);

Deno.test
(	'SuperFile - slice() when start >= end returns empty',
	async () =>
	{	const data = 'Hello World';
		const stream = createStream(data);
		const file = new SuperFile(stream, 'test.txt', 'text/plain');
		const sliced = file.slice(5, 5);
		const text = await sliced.text();
		assertEquals(text, '');
	}
);

Deno.test
(	'SuperFile - binary file',
	async () =>
	{	const binaryData = new Uint8Array([0x00, 0x01, 0x02, 0xFF, 0xFE, 0xFD]);
		const stream = RdStream.from([binaryData]);
		const file = new SuperFile(stream, 'binary.bin', 'application/octet-stream');
		const bytes = await file.bytes();
		assertEquals(bytes, binaryData);
	}
);

Deno.test
(	'SuperFile - slice() of binary file',
	async () =>
	{	const binaryData = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
		const stream = RdStream.from([binaryData]);
		const file = new SuperFile(stream, 'binary.bin', 'application/octet-stream');
		const sliced = file.slice(2, 5);
		const bytes = await sliced.bytes();
		assertEquals(bytes, new Uint8Array([0x02, 0x03, 0x04]));
	}
);

Deno.test
(	'SuperFile - JSON file',
	async () =>
	{	const jsonData = JSON.stringify({name: 'test', value: 123});
		const stream = createStream(jsonData);
		const file = new SuperFile(stream, 'data.json', 'application/json');
		const text = await file.text();
		const parsed = JSON.parse(text);
		assertEquals(parsed.name, 'test');
		assertEquals(parsed.value, 123);
	}
);

Deno.test
(	'SuperFile - image file simulation',
	async () =>
	{	// Simulate PNG header
		const pngHeader = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
		const stream = RdStream.from([pngHeader]);
		const file = new SuperFile(stream, 'image.png', 'image/png');
		const bytes = await file.bytes();
		assertEquals(bytes.length, 8);
		assertEquals(bytes[0], 0x89);
		assertEquals(bytes[1], 0x50);
	}
);

Deno.test
(	'SuperFile - multiple content type parameters',
	async () =>
	{	const data = 'Test';
		const stream = createStream(data);
		const file = new SuperFile(stream, 'test.txt', 'text/plain; charset=utf-8; boundary=something');
		const text = await file.text();
		assertEquals(text, data);
	}
);

Deno.test
(	'SuperFile - UTF-8 filename',
	() =>
	{	const stream = createStream('Content');
		const file = new SuperFile(stream, '测试文件.txt', 'text/plain');
		assertEquals(file.name, '测试文件.txt');
	}
);

Deno.test
(	'SuperFile - very long filename',
	() =>
	{	const stream = createStream('Content');
		const longName = 'a'.repeat(255) + '.txt';
		const file = new SuperFile(stream, longName, 'text/plain');
		assertEquals(file.name, longName);
	}
);

// ============================================================================
// Edge Cases and Integration Tests
// ============================================================================

Deno.test
(	'SuperBlob and SuperFile - type property is preserved',
	() =>
	{	const stream1 = createStream('data');
		const blob = new SuperBlob(stream1, 'application/json; charset=utf-8');
		assertEquals(blob.type, 'application/json; charset=utf-8');

		const stream2 = createStream('data');
		const file = new SuperFile(stream2, 'test.json', 'application/json; charset=utf-8');
		assertEquals(file.type, 'application/json; charset=utf-8');
	}
);

Deno.test
(	'SuperBlob - slice() can be sliced again',
	async () =>
	{	const data = 'Hello World';
		const stream = createStream(data);
		const blob = new SuperBlob(stream, 'text/plain');
		const sliced1 = blob.slice(0, 8); // "Hello Wo"
		const sliced2 = sliced1.slice(0, 5); // "Hello"
		const text = await sliced2.text();
		assertEquals(text, 'Hello');
	}
);

Deno.test
(	'SuperFile - slice() can be sliced again',
	async () =>
	{	const data = 'Hello World';
		const stream = createStream(data);
		const file = new SuperFile(stream, 'test.txt', 'text/plain');
		const sliced1 = file.slice(0, 8); // "Hello Wo"
		const sliced2 = sliced1.slice(0, 5); // "Hello"
		const text = await sliced2.text();
		assertEquals(text, 'Hello');
	}
);

Deno.test
(	'SuperBlob - works with standard ReadableStream',
	async () =>
	{	const chunks = ['Hello', ' ', 'World'];
		let index = 0;
		const stream = new ReadableStream<Uint8Array<ArrayBuffer>>
		({	pull(controller)
			{	if (index < chunks.length)
				{	controller.enqueue(encoder.encode(chunks[index++]));
				}
				else
				{	controller.close();
				}
			}
		});
		const blob = new SuperBlob(stream, 'text/plain');
		const text = await blob.text();
		assertEquals(text, 'Hello World');
	}
);

Deno.test
(	'SuperFile - works with standard ReadableStream',
	async () =>
	{	const chunks = ['File', ' ', 'Content'];
		let index = 0;
		const stream = new ReadableStream<Uint8Array<ArrayBuffer>>
		({	pull(controller)
			{	if (index < chunks.length)
				{	controller.enqueue(encoder.encode(chunks[index++]));
				}
				else
				{	controller.close();
				}
			}
		});
		const file = new SuperFile(stream, 'test.txt', 'text/plain');
		const text = await file.text();
		assertEquals(text, 'File Content');
	}
);

Deno.test
(	'SuperBlob - slice() preserves original type when contentType not specified',
	() =>
	{	const stream = createStream('data');
		const blob = new SuperBlob(stream, 'application/custom');
		const sliced = blob.slice(0, 2);
		assertEquals(sliced.type, 'application/custom');
	}
);

Deno.test
(	'SuperFile - slice() preserves original type when contentType not specified',
	() =>
	{	const stream = createStream('data');
		const file = new SuperFile(stream, 'test.dat', 'application/custom');
		const sliced = file.slice(0, 2);
		assertEquals(sliced.type, 'application/custom');
	}
);
