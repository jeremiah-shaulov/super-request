import {parseFormUrlencoded} from '../form_url_encoded.ts';
import {assertEquals} from './deps.ts';
import {RdStream} from '../deps.ts';

const encoder = new TextEncoder;

/**	Helper function to create a ReadableStream from a string
 **/
function createStream(data: string): ReadableStream<Uint8Array>
{	return RdStream.from([encoder.encode(data)]);
}

/**	Helper function to create a chunked ReadableStream
 **/
function createChunkedStream(data: string, chunkSize: number): ReadableStream<Uint8Array>
{	const encoded = encoder.encode(data);
	const chunks = new Array<Uint8Array>;

	for (let i=0; i<encoded.length; i+=chunkSize)
	{	chunks.push(encoded.subarray(i, Math.min(i + chunkSize, encoded.length)));
	}

	return RdStream.from(chunks);
}

/**	Helper function to collect all params from the async generator
 **/
async function collectParams(stream: ReadableStream<Uint8Array>, charset?: string)
{	const result = new Array<{name: string, value?: string}>;
	for await (const param of parseFormUrlencoded(stream, charset))
	{	result.push(param);
	}
	return result;
}

Deno.test
(	'Simple key-value pairs',
	async () =>
	{	const stream = createStream('key1=value1&key2=value2');
		const params = await collectParams(stream);
		assertEquals
		(	params,
			[	{name: 'key1', value: 'value1'},
				{name: 'key2', value: 'value2'}
			]
		);
	}
);

Deno.test
(	'Key without value',
	async () =>
	{	const stream = createStream('key1&key2=value2');
		const params = await collectParams(stream);
		assertEquals
		(	params,
			[	{name: 'key1'},
				{name: 'key2', value: 'value2'}
			]
		);
	}
);

Deno.test
(	'Empty value',
	async () =>
	{	const stream = createStream('key1=&key2=value2');
		const params = await collectParams(stream);
		assertEquals
		(	params,
			[	{name: 'key1', value: ''},
				{name: 'key2', value: 'value2'}
			]
		);
	}
);

Deno.test
(	'Plus sign as space',
	async () =>
	{	const stream = createStream('name=John+Doe&city=New+York');
		const params = await collectParams(stream);
		assertEquals
		(	params,
			[	{name: 'name', value: 'John Doe'},
				{name: 'city', value: 'New York'}
			]
		);
	}
);

Deno.test
(	'Percent encoding',
	async () =>
	{	const stream = createStream('email=user%40example.com&path=%2Fhome%2Fuser');
		const params = await collectParams(stream);
		assertEquals
		(	params,
			[	{name: 'email', value: 'user@example.com'},
				{name: 'path', value: '/home/user'}
			]
		);
	}
);

Deno.test
(	'Mixed plus and percent encoding',
	async () =>
	{	const stream = createStream('text=Hello+World%21&name=John+%26+Jane');
		const params = await collectParams(stream);
		assertEquals
		(	params,
			[	{name: 'text', value: 'Hello World!'},
				{name: 'name', value: 'John & Jane'}
			]
		);
	}
);

Deno.test
(	'Empty string',
	async () =>
	{	const stream = createStream('');
		const params = await collectParams(stream);
		// Empty string yields one empty parameter name
		assertEquals(params, [{name: ''}]);
	}
);

Deno.test
(	'Single parameter',
	async () =>
	{	const stream = createStream('single=value');
		const params = await collectParams(stream);
		assertEquals(params, [{name: 'single', value: 'value'}]);
	}
);

Deno.test
(	'Single parameter without value',
	async () =>
	{	const stream = createStream('single');
		const params = await collectParams(stream);
		assertEquals(params, [{name: 'single'}]);
	}
);

Deno.test
(	'Multiple ampersands',
	async () =>
	{	const stream = createStream('a=1&&b=2&&&c=3');
		const params = await collectParams(stream);
		assertEquals
		(	params,
			[	{name: 'a', value: '1'},
				{name: ''},
				{name: 'b', value: '2'},
				{name: ''},
				{name: ''},
				{name: 'c', value: '3'}
			]
		);
	}
);

Deno.test
(	'Special characters in values',
	async () =>
	{	const stream = createStream('chars=%21%40%23%24%25%5E%26*()');
		const params = await collectParams(stream);
		assertEquals(params, [{name: 'chars', value: '!@#$%^&*()'}]);
	}
);

Deno.test
(	'Unicode characters',
	async () =>
	{	const stream = createStream('name=%E4%BD%A0%E5%A5%BD&emoji=%F0%9F%98%80');
		const params = await collectParams(stream);
		assertEquals
		(	params,
			[	{name: 'name', value: '你好'},
				{name: 'emoji', value: '😀'}
			]
		);
	}
);

Deno.test
(	'Array notation',
	async () =>
	{	const stream = createStream('items%5B%5D=a&items%5B%5D=b&items%5B%5D=c');
		const params = await collectParams(stream);
		assertEquals
		(	params,
			[	{name: 'items[]', value: 'a'},
				{name: 'items[]', value: 'b'},
				{name: 'items[]', value: 'c'}
			]
		);
	}
);

Deno.test
(	'Long parameter name',
	async () =>
	{	const longName = 'a'.repeat(1000);
		const stream = createStream(`${encodeURIComponent(longName)}=value`);
		const params = await collectParams(stream);
		assertEquals(params, [{name: longName, value: 'value'}]);
	}
);

Deno.test
(	'Long parameter value',
	async () =>
	{	const longValue = 'v'.repeat(10000);
		const stream = createStream(`key=${encodeURIComponent(longValue)}`);
		const params = await collectParams(stream);
		assertEquals(params, [{name: 'key', value: longValue}]);
	}
);

Deno.test
(	'Multiple parameters with same name',
	async () =>
	{	const stream = createStream('tag=red&tag=blue&tag=green');
		const params = await collectParams(stream);
		assertEquals
		(	params,
			[	{name: 'tag', value: 'red'},
				{name: 'tag', value: 'blue'},
				{name: 'tag', value: 'green'}
			]
		);
	}
);

Deno.test
(	'Equals sign in value',
	async () =>
	{	const stream = createStream('math=1%2B1%3D2&equation=E%3Dmc%5E2');
		const params = await collectParams(stream);
		assertEquals
		(	params,
			[	{name: 'math', value: '1+1=2'},
				{name: 'equation', value: 'E=mc^2'}
			]
		);
	}
);

Deno.test
(	'Ampersand in value',
	async () =>
	{	const stream = createStream('text=rock%26roll&expr=a%26%26b');
		const params = await collectParams(stream);
		assertEquals
		(	params,
			[	{name: 'text', value: 'rock&roll'},
				{name: 'expr', value: 'a&&b'}
			]
		);
	}
);

Deno.test
(	'Incomplete percent encoding at end',
	async () =>
	{	const stream = createStream('key=value%2');
		const params = await collectParams(stream);
		// Incomplete encoding is passed through as-is
		assertEquals(params, [{name: 'key', value: 'value%2'}]);
	}
);

Deno.test
(	'Percent without hex digits',
	async () =>
	{	const stream = createStream('key=value%');
		const params = await collectParams(stream);
		assertEquals(params, [{name: 'key', value: 'value%'}]);
	}
);

Deno.test
(	'Lowercase hex digits',
	async () =>
	{	const stream = createStream('key=%61%62%63');
		const params = await collectParams(stream);
		assertEquals(params, [{name: 'key', value: 'abc'}]);
	}
);

Deno.test
(	'Uppercase hex digits',
	async () =>
	{	const stream = createStream('key=%41%42%43');
		const params = await collectParams(stream);
		assertEquals(params, [{name: 'key', value: 'ABC'}]);
	}
);

Deno.test
(	'Mixed case hex digits',
	async () =>
	{	const stream = createStream('key=%4a%4B%4c');
		const params = await collectParams(stream);
		assertEquals(params, [{name: 'key', value: 'JKL'}]);
	}
);

Deno.test
(	'Chunked stream - small chunks',
	async () =>
	{	const data = 'key1=value1&key2=value2&key3=value3';
		const stream = createChunkedStream(data, 5);
		const params = await collectParams(stream);
		assertEquals
		(	params,
			[	{name: 'key1', value: 'value1'},
				{name: 'key2', value: 'value2'},
				{name: 'key3', value: 'value3'}
			]
		);
	}
);

Deno.test
(	'Chunked stream - boundary splits encoding',
	async () =>
	{	const parts = [encoder.encode('key=value%'), encoder.encode('20test')];
		const stream = RdStream.from(parts);
		const params = await collectParams(stream);
		assertEquals(params, [{name: 'key', value: 'value test'}]);
	}
);

Deno.test
(	'Very large data requiring buffer reallocation',
	async () =>
	{	// Create data larger than initial buffer (8KB)
		const largeValue = 'x'.repeat(20000);
		const stream = createStream(`key=${largeValue}`);
		const params = await collectParams(stream);
		assertEquals(params, [{name: 'key', value: largeValue}]);
	}
);

Deno.test
(	'Alternative charset - ISO-8859-1',
	async () =>
	{	// Create stream with ISO-8859-1 encoded data
		const data = new Uint8Array([0x6E, 0x61, 0x6D, 0x65, 0x3D, 0xF1]); // "name=ñ"
		const stream = RdStream.from([data]);
		const params = await collectParams(stream, 'iso-8859-1');
		assertEquals(params, [{name: 'name', value: 'ñ'}]);
	}
);

Deno.test
(	'Real-world form data',
	async () =>
	{	const stream = createStream('username=john_doe&password=secret123&remember=on&email=john%40example.com');
		const params = await collectParams(stream);
		assertEquals
		(	params,
			[	{name: 'username', value: 'john_doe'},
				{name: 'password', value: 'secret123'},
				{name: 'remember', value: 'on'},
				{name: 'email', value: 'john@example.com'}
			]
		);
	}
);

Deno.test
(	'Complex query with nested structures',
	async () =>
	{	const stream = createStream('filter%5Bstatus%5D=active&filter%5Btags%5D%5B%5D=urgent&sort=date&page=1');
		const params = await collectParams(stream);
		assertEquals
		(	params,
			[	{name: 'filter[status]', value: 'active'},
				{name: 'filter[tags][]', value: 'urgent'},
				{name: 'sort', value: 'date'},
				{name: 'page', value: '1'}
			]
		);
	}
);

Deno.test
(	'Empty parameter name with value',
	async () =>
	{	const stream = createStream('=value');
		const params = await collectParams(stream);
		assertEquals(params, [{name: '', value: 'value'}]);
	}
);

Deno.test
(	'Parameter ending with equals',
	async () =>
	{	const stream = createStream('key1=value1&key2=');
		const params = await collectParams(stream);
		assertEquals
		(	params,
			[	{name: 'key1', value: 'value1'},
				{name: 'key2', value: ''}
			]
		);
	}
);

Deno.test
(	'Multiple equals signs',
	async () =>
	{	const stream = createStream('key=val=ue=test');
		const params = await collectParams(stream);
		// First equals splits name/value, rest are part of value
		assertEquals(params, [{name: 'key', value: 'val=ue=test'}]);
	}
);

Deno.test
(	'Tab and newline characters',
	async () =>
	{	const stream = createStream('text=line1%0Aline2%09tab');
		const params = await collectParams(stream);
		assertEquals(params, [{name: 'text', value: 'line1\nline2\ttab'}]);
	}
);

Deno.test
(	'Null byte in value',
	async () =>
	{	const stream = createStream('data=before%00after');
		const params = await collectParams(stream);
		assertEquals(params, [{name: 'data', value: 'before\0after'}]);
	}
);

Deno.test
(	'High ASCII values',
	async () =>
	{	const stream = createStream('char=%FF%FE');
		const params = await collectParams(stream);
		// TextDecoder will handle these bytes according to UTF-8 decoding
		assertEquals(params.length, 1);
		assertEquals(params[0].name, 'char');
	}
);