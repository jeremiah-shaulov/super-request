import {parseFormData} from '../form_data.ts';
import {SuperFile} from '../super_file.ts';
import {assertEquals, assert} from './deps.ts';
import {RdStream} from '../deps.ts';

const encoder = new TextEncoder;

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

type CollectedEntry = {name: string; value: string | {filename: string; type: string; content: string}};

/**	Helper function to collect all entries from the async generator
 **/
async function collectEntries(stream: RdStream, charset: string|undefined, boundary: string)
{	const result = new Array<CollectedEntry>;
	for await (const entry of parseFormData(stream, charset, boundary))
	{	if (entry.value instanceof SuperFile)
		{	// Read file content
			const content = await entry.value.text();
			result.push({name: entry.name, value: {filename: entry.value.name, type: entry.value.type, content}});
		}
		else
		{	result.push({name: entry.name, value: entry.value});
		}
	}
	return result;
}

Deno.test
(	'Simple form field',
	async () =>
	{	const boundary = '----boundary';
		const data =
			`------boundary\r\n` +
			`Content-Disposition: form-data; name="field1"\r\n` +
			`\r\n` +
			`value1\r\n` +
			`------boundary--`;
		const stream = createStream(data);
		const entries = await collectEntries(stream, undefined, boundary);
		assertEquals(entries, [{name: 'field1', value: 'value1'}]);
	}
);

Deno.test
(	'Multiple form fields',
	async () =>
	{	const boundary = '----boundary';
		const data =
			`------boundary\r\n` +
			`Content-Disposition: form-data; name="user_id"\r\n` +
			`\r\n` +
			`3\r\n` +
			`------boundary\r\n` +
			`Content-Disposition: form-data; name="post_id"\r\n` +
			`\r\n` +
			`5\r\n` +
			`------boundary--`;
		const stream = createStream(data);
		const entries = await collectEntries(stream, undefined, boundary);
		assertEquals
		(	entries,
			[	{name: 'user_id', value: '3'},
				{name: 'post_id', value: '5'}
			]
		);
	}
);

Deno.test
(	'File upload',
	async () =>
	{	const boundary = '----boundary';
		const data =
			`------boundary\r\n` +
			`Content-Disposition: form-data; name="image"; filename="test.txt"\r\n` +
			`Content-Type: text/plain\r\n` +
			`\r\n` +
			`File content here\r\n` +
			`------boundary--`;
		const stream = createStream(data);
		const entries = await collectEntries(stream, undefined, boundary);
		assertEquals(entries.length, 1);
		assertEquals(entries[0].name, 'image');
		assert(typeof entries[0].value === 'object');
		const fileValue = entries[0].value;
		assertEquals(fileValue.filename, 'test.txt');
		assertEquals(fileValue.type, 'text/plain');
		assertEquals(fileValue.content, 'File content here');
	}
);

Deno.test
(	'Mixed fields and files',
	async () =>
	{	const boundary = '----boundary';
		const data =
			`------boundary\r\n` +
			`Content-Disposition: form-data; name="username"\r\n` +
			`\r\n` +
			`john_doe\r\n` +
			`------boundary\r\n` +
			`Content-Disposition: form-data; name="avatar"; filename="avatar.png"\r\n` +
			`Content-Type: image/png\r\n` +
			`\r\n` +
			`PNG_DATA\r\n` +
			`------boundary\r\n` +
			`Content-Disposition: form-data; name="bio"\r\n` +
			`\r\n` +
			`My biography\r\n` +
			`------boundary--`;
		const stream = createStream(data);
		const entries = await collectEntries(stream, undefined, boundary);
		assertEquals(entries.length, 3);
		assertEquals(entries[0], {name: 'username', value: 'john_doe'});
		assertEquals(entries[1].name, 'avatar');
		assert(typeof entries[1].value === 'object');
		const avatarValue = entries[1].value;
		assertEquals(avatarValue.filename, 'avatar.png');
		assertEquals(avatarValue.type, 'image/png');
		assertEquals(avatarValue.content, 'PNG_DATA');
		assertEquals(entries[2], {name: 'bio', value: 'My biography'});
	}
);

Deno.test
(	'Empty field value',
	async () =>
	{	const boundary = '----boundary';
		const data =
			`------boundary\r\n` +
			`Content-Disposition: form-data; name="empty"\r\n` +
			`\r\n` +
			`\r\n` +
			`------boundary--`;
		const stream = createStream(data);
		const entries = await collectEntries(stream, undefined, boundary);
		assertEquals(entries, [{name: 'empty', value: ''}]);
	}
);

Deno.test
(	'Field with multiline value',
	async () =>
	{	const boundary = '----boundary';
		const data =
			`------boundary\r\n` +
			`Content-Disposition: form-data; name="description"\r\n` +
			`\r\n` +
			`Line 1\r\n` +
			`Line 2\r\n` +
			`Line 3\r\n` +
			`------boundary--`;
		const stream = createStream(data);
		const entries = await collectEntries(stream, undefined, boundary);
		assertEquals(entries, [{name: 'description', value: 'Line 1\r\nLine 2\r\nLine 3'}]);
	}
);

Deno.test
(	'Field name with quotes',
	async () =>
	{	const boundary = '----boundary';
		const data =
			`------boundary\r\n` +
			`Content-Disposition: form-data; name="field\\"name"\r\n` +
			`\r\n` +
			`value\r\n` +
			`------boundary--`;
		const stream = createStream(data);
		const entries = await collectEntries(stream, undefined, boundary);
		assertEquals(entries, [{name: 'field"name', value: 'value'}]);
	}
);

Deno.test
(	'Field name with backslash',
	async () =>
	{	const boundary = '----boundary';
		const data =
			`------boundary\r\n` +
			`Content-Disposition: form-data; name="field\\\\name"\r\n` +
			`\r\n` +
			`value\r\n` +
			`------boundary--`;
		const stream = createStream(data);
		const entries = await collectEntries(stream, undefined, boundary);
		assertEquals(entries, [{name: 'field\\name', value: 'value'}]);
	}
);

Deno.test
(	'Filename with special characters',
	async () =>
	{	const boundary = '----boundary';
		const data =
			`------boundary\r\n` +
			`Content-Disposition: form-data; name="file"; filename="/tmp/my\\"file\\\\test.txt"\r\n` +
			`Content-Type: text/plain\r\n` +
			`\r\n` +
			`content\r\n` +
			`------boundary--`;
		const stream = createStream(data);
		const entries = await collectEntries(stream, undefined, boundary);
		assertEquals(entries.length, 1);
		assertEquals(entries[0].name, 'file');
		assert(typeof entries[0].value === 'object');
		const fileValue = entries[0].value;
		assertEquals(fileValue.filename, '/tmp/my"file\\test.txt');
	}
);

Deno.test
(	'Preamble before first boundary',
	async () =>
	{	const boundary = '----boundary';
		const data =
			`This is preamble text that should be ignored\r\n` +
			`More preamble\r\n` +
			`------boundary\r\n` +
			`Content-Disposition: form-data; name="field"\r\n` +
			`\r\n` +
			`value\r\n` +
			`------boundary--`;
		const stream = createStream(data);
		const entries = await collectEntries(stream, undefined, boundary);
		assertEquals(entries, [{name: 'field', value: 'value'}]);
	}
);

Deno.test
(	'Chunked stream - small chunks',
	async () =>
	{	const boundary = '----boundary';
		const data =
			`------boundary\r\n` +
			`Content-Disposition: form-data; name="field1"\r\n` +
			`\r\n` +
			`value1\r\n` +
			`------boundary\r\n` +
			`Content-Disposition: form-data; name="field2"\r\n` +
			`\r\n` +
			`value2\r\n` +
			`------boundary--`;
		for (const chunkSize of [1, 2, 3, 4, 5, 9, 10, 11, 20, 30, 50])
		{	// Use larger chunk size to avoid splitting boundaries
			const stream = createChunkedStream(data, chunkSize);
			const entries = await collectEntries(stream, undefined, boundary);
			assertEquals
			(	entries,
				[	{name: 'field1', value: 'value1'},
					{name: 'field2', value: 'value2'}
				]
			);
		}
	}
);

Deno.test
(	'Chunked stream - boundary split across chunks',
	async () =>
	{	const boundary = '----boundary';
		const data =
			`------boundary\r\n` +
			`Content-Disposition: form-data; name="field"\r\n` +
			`\r\n` +
			`value\r\n` +
			`------boundary--`;
		// Split exactly at boundary
		const part1 = data.slice(0, data.indexOf('------boundary', 10));
		const part2 = data.slice(part1.length);
		const stream = RdStream.from([encoder.encode(part1), encoder.encode(part2)]);
		const entries = await collectEntries(stream, undefined, boundary);
		assertEquals(entries, [{name: 'field', value: 'value'}]);
	}
);

Deno.test
(	'Large field value',
	async () =>
	{	const boundary = '----boundary';
		const largeValue = 'x'.repeat(100000);
		const data =
			`------boundary\r\n` +
			`Content-Disposition: form-data; name="large"\r\n` +
			`\r\n` +
			`${largeValue}\r\n` +
			`------boundary--`;
		const stream = createStream(data);
		const entries = await collectEntries(stream, undefined, boundary);
		assertEquals(entries, [{name: 'large', value: largeValue}]);
	}
);

Deno.test
(	'Large file upload',
	async () =>
	{	const boundary = '----boundary';
		const largeContent = 'FILE_CONTENT_'.repeat(10000);
		const data =
			`------boundary\r\n` +
			`Content-Disposition: form-data; name="bigfile"; filename="large.dat"\r\n` +
			`Content-Type: application/octet-stream\r\n` +
			`\r\n` +
			`${largeContent}\r\n` +
			`------boundary--`;
		const stream = createStream(data);
		const entries = await collectEntries(stream, undefined, boundary);
		assertEquals(entries.length, 1);
		assertEquals(entries[0].name, 'bigfile');
		assert(typeof entries[0].value === 'object');
		const fileValue = entries[0].value;
		assertEquals(fileValue.filename, 'large.dat');
		assertEquals(fileValue.content, largeContent);
	}
);

Deno.test
(	'UTF-8 field value',
	async () =>
	{	const boundary = '----boundary';
		const data =
			`------boundary\r\n` +
			`Content-Disposition: form-data; name="unicode"\r\n` +
			`\r\n` +
			`Hello 世界 🌍\r\n` +
			`------boundary--`;
		const stream = createStream(data);
		const entries = await collectEntries(stream, undefined, boundary);
		assertEquals(entries, [{name: 'unicode', value: 'Hello 世界 🌍'}]);
	}
);

Deno.test
(	'Alternative charset - ISO-8859-1',
	async () =>
	{	const boundary = '----boundary';
		const headerPart =
			`------boundary\r\n` +
			`Content-Disposition: form-data; name="latin1"\r\n` +
			`\r\n`;
		const valueByte = new Uint8Array([0xF1]); // ñ in ISO-8859-1
		const footerPart = `\r\n------boundary--`;
		const parts = [encoder.encode(headerPart), valueByte, encoder.encode(footerPart)];
		const stream = RdStream.from(parts);
		const entries = await collectEntries(stream, 'iso-8859-1', boundary);
		assertEquals(entries, [{name: 'latin1', value: 'ñ'}]);
	}
);

Deno.test
(	'Content-Type with spaces',
	async () =>
	{	const boundary = '----boundary';
		const data =
			`------boundary\r\n` +
			`Content-Disposition: form-data; name="file"; filename="test.jpg"\r\n` +
			`Content-Type:   image/jpeg  \r\n` +
			`\r\n` +
			`JPEG_DATA\r\n` +
			`------boundary--`;
		const stream = createStream(data);
		const entries = await collectEntries(stream, undefined, boundary);
		assertEquals(entries.length, 1);
		assert(typeof entries[0].value === 'object');
		const fileValue = entries[0].value;
		assertEquals(fileValue.type, 'image/jpeg');
	}
);

Deno.test
(	'Multiple files with same field name',
	async () =>
	{	const boundary = '----boundary';
		const data =
			`------boundary\r\n` +
			`Content-Disposition: form-data; name="files"; filename="file1.txt"\r\n` +
			`Content-Type: text/plain\r\n` +
			`\r\n` +
			`Content 1\r\n` +
			`------boundary\r\n` +
			`Content-Disposition: form-data; name="files"; filename="file2.txt"\r\n` +
			`Content-Type: text/plain\r\n` +
			`\r\n` +
			`Content 2\r\n` +
			`------boundary--`;
		const stream = createStream(data);
		const entries = await collectEntries(stream, undefined, boundary);
		assertEquals(entries.length, 2);
		assertEquals(entries[0].name, 'files');
		assertEquals(entries[1].name, 'files');
		assert(typeof entries[0].value === 'object');
		assert(typeof entries[1].value === 'object');
		const file1Value = entries[0].value;
		const file2Value = entries[1].value;
		assertEquals(file1Value.filename, 'file1.txt');
		assertEquals(file2Value.filename, 'file2.txt');
		assertEquals(file1Value.content, 'Content 1');
		assertEquals(file2Value.content, 'Content 2');
	}
);

Deno.test
(	'Case-insensitive header names',
	async () =>
	{	const boundary = '----boundary';
		const data =
			`------boundary\r\n` +
			`CONTENT-DISPOSITION: form-data; name="field"\r\n` +
			`\r\n` +
			`value\r\n` +
			`------boundary--`;
		const stream = createStream(data);
		const entries = await collectEntries(stream, undefined, boundary);
		assertEquals(entries, [{name: 'field', value: 'value'}]);
	}
);

Deno.test
(	'Extra whitespace in Content-Disposition',
	async () =>
	{	const boundary = '----boundary';
		const data =
			`------boundary\r\n` +
			`Content-Disposition:  form-data;  name="field"  \r\n` +
			`\r\n` +
			`value\r\n` +
			`------boundary--`;
		const stream = createStream(data);
		const entries = await collectEntries(stream, undefined, boundary);
		assertEquals(entries, [{name: 'field', value: 'value'}]);
	}
);

Deno.test
(	'Unknown headers are ignored',
	async () =>
	{	const boundary = '----boundary';
		const data =
			`------boundary\r\n` +
			`Content-Disposition: form-data; name="field"\r\n` +
			`X-Custom-Header: custom-value\r\n` +
			`\r\n` +
			`value\r\n` +
			`------boundary--`;
		const stream = createStream(data);
		const entries = await collectEntries(stream, undefined, boundary);
		assertEquals(entries, [{name: 'field', value: 'value'}]);
	}
);

Deno.test
(	'Real-world multipart form example',
	async () =>
	{	const data =
			`------WebKitFormBoundary7MA4YWxkTrZu0gW\r\n` +
			`Content-Disposition: form-data; name="username"\r\n` +
			`\r\n` +
			`john_doe\r\n` +
			`------WebKitFormBoundary7MA4YWxkTrZu0gW\r\n` +
			`Content-Disposition: form-data; name="email"\r\n` +
			`\r\n` +
			`john@example.com\r\n` +
			`------WebKitFormBoundary7MA4YWxkTrZu0gW\r\n` +
			`Content-Disposition: form-data; name="profile_pic"; filename="avatar.jpg"\r\n` +
			`Content-Type: image/jpeg\r\n` +
			`\r\n` +
			`JPEG_BINARY_DATA_HERE\r\n` +
			`------WebKitFormBoundary7MA4YWxkTrZu0gW\r\n` +
			`Content-Disposition: form-data; name="bio"\r\n` +
			`\r\n` +
			`Software developer\r\nLoves coding\r\n` +
			`------WebKitFormBoundary7MA4YWxkTrZu0gW--`;
		const stream = createStream(data);
		const entries = await collectEntries(stream, undefined, '----WebKitFormBoundary7MA4YWxkTrZu0gW');
		assertEquals(entries.length, 4);
		assertEquals(entries[0], {name: 'username', value: 'john_doe'});
		assertEquals(entries[1], {name: 'email', value: 'john@example.com'});
		assertEquals(entries[2].name, 'profile_pic');
		assert(typeof entries[2].value === 'object');
		const profilePicValue = entries[2].value;
		assertEquals(profilePicValue.filename, 'avatar.jpg');
		assertEquals(profilePicValue.type, 'image/jpeg');
		assertEquals(entries[3], {name: 'bio', value: 'Software developer\r\nLoves coding'});
	}
);

Deno.test
(	'Empty boundary should throw error',
	async () =>
	{	const stream = createStream('data');
		let error: Error | undefined;
		try
		{	for await (const _ of parseFormData(stream, undefined, ''))
			{	// Should not reach here
			}
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assert(error);
		assertEquals(error.message, 'Invalid boundary');
	}
);

Deno.test
(	'Boundary too long should throw error',
	async () =>
	{	const stream = createStream('data');
		const longBoundary = '-'.repeat(101);
		let error: Error | undefined;
		try
		{	for await (const _ of parseFormData(stream, undefined, longBoundary))
			{	// Should not reach here
			}
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assert(error);
		assertEquals(error.message, 'Invalid boundary');
	}
);

Deno.test
(	'Stream ending before first boundary should throw error',
	async () =>
	{	const boundary = '----boundary';
		const data = `Some data but no boundary`;
		const stream = createStream(data);
		let error: Error | undefined;
		try
		{	for await (const _ of parseFormData(stream, undefined, boundary))
			{	// Should not reach here
			}
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assert(error);
		assertEquals(error.message, 'Incomplete multipart body');
	}
);

Deno.test
(	'Missing Content-Disposition header should continue',
	async () =>
	{	const boundary = '----boundary';
		const data =
			`------boundary\r\n` +
			`Content-Type: text/plain\r\n` +
			`\r\n` +
			`value\r\n` +
			`------boundary--`;
		const stream = createStream(data);
		const entries = await collectEntries(stream, undefined, boundary);
		// Without Content-Disposition, name will be empty
		assertEquals(entries, [{name: '', value: 'value'}]);
	}
);

Deno.test
(	'File without Content-Type',
	async () =>
	{	const boundary = '----boundary';
		const data =
			`------boundary\r\n` +
			`Content-Disposition: form-data; name="file"; filename="test.txt"\r\n` +
			`\r\n` +
			`content\r\n` +
			`------boundary--`;
		const stream = createStream(data);
		const entries = await collectEntries(stream, undefined, boundary);
		assertEquals(entries.length, 1);
		assert(typeof entries[0].value === 'object');
		const fileValue = entries[0].value;
		assertEquals(fileValue.filename, 'test.txt');
		assertEquals(fileValue.type, '');
	}
);

Deno.test
(	'Binary file content',
	async () =>
	{	const boundary = '----boundary';
		const headerPart =
			`------boundary\r\n` +
			`Content-Disposition: form-data; name="binary"; filename="data.bin"\r\n` +
			`Content-Type: application/octet-stream\r\n` +
			`\r\n`;
		const binaryData = new Uint8Array([0x00, 0x01, 0x02, 0xFF, 0xFE, 0xFD]);
		const footerPart = `\r\n------boundary--`;
		const parts = [encoder.encode(headerPart), binaryData, encoder.encode(footerPart)];
		const stream = RdStream.from(parts);
		const entries = await collectEntries(stream, undefined, boundary);
		assertEquals(entries.length, 1);
		assertEquals(entries[0].name, 'binary');
		assert(typeof entries[0].value === 'object');
		// Content will be decoded as UTF-8, which may produce replacement characters
		const fileValue = entries[0].value;
		assertEquals(fileValue.filename, 'data.bin');
	}
);

Deno.test
(	'Field value exactly at buffer boundary',
	async () =>
	{	const boundary = '----boundary';
		// Create a value that's exactly 32KB (BUFFER_LEN)
		const largeValue = 'x'.repeat(32 * 1024);
		const data =
			`------boundary\r\n` +
			`Content-Disposition: form-data; name="large"\r\n` +
			`\r\n` +
			`${largeValue}\r\n` +
			`------boundary--`;
		const stream = createStream(data);
		const entries = await collectEntries(stream, undefined, boundary);
		assertEquals(entries, [{name: 'large', value: largeValue}]);
	}
);

Deno.test
(	'Multiple CRLF before boundary',
	async () =>
	{	const boundary = '----boundary';
		const data =
			`------boundary\r\n` +
			`Content-Disposition: form-data; name="field"\r\n` +
			`\r\n` +
			`value\r\n\r\n\r\n` +
			`------boundary--`;
		const stream = createStream(data);
		const entries = await collectEntries(stream, undefined, boundary);
		// The extra CRLF should be part of the value except the last one before boundary
		assertEquals(entries, [{name: 'field', value: 'value\r\n\r\n'}]);
	}
);

Deno.test
(	'Whitespace after final boundary',
	async () =>
	{	const boundary = '----boundary';
		const data =
			`------boundary\r\n` +
			`Content-Disposition: form-data; name="field"\r\n` +
			`\r\n` +
			`value\r\n` +
			`------boundary--\r\n  \t\r\n`;
		const stream = createStream(data);
		const entries = await collectEntries(stream, undefined, boundary);
		assertEquals(entries, [{name: 'field', value: 'value'}]);
	}
);
