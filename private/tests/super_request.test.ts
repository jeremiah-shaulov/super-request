import {SuperRequest, TooBigError} from '../super_request.ts';
import {assertEquals, assert} from './deps.ts';
import {CancelError, RdStream} from '../deps.ts';

const encoder = new TextEncoder;
const decoder = new TextDecoder;

// ============================================================================
// Basic Constructor Tests
// ============================================================================

Deno.test
(	'SuperRequest - constructor with URL string',
	() =>
	{	const req = new SuperRequest('https://example.com/test');
		assertEquals(req.url, 'https://example.com/test');
		assertEquals(req.method, 'GET');
	}
);

Deno.test
(	'SuperRequest - constructor with URL object',
	() =>
	{	const req = new SuperRequest(new URL('https://example.com/test'));
		assertEquals(req.url, 'https://example.com/test');
		assertEquals(req.method, 'GET');
	}
);

Deno.test
(	'SuperRequest - constructor with Request object',
	async () =>
	{	const body = JSON.stringify({key: 'value'});
		const originalReq = new Request('https://example.com/test', {method: 'POST', body});
		const req = new SuperRequest(originalReq);
		assertEquals(req.url, 'https://example.com/test');
		assertEquals(req.method, 'POST');
		assertEquals(await req.json(), {key: 'value'});
	}
);

Deno.test
(	'SuperRequest - constructor with init options',
	() =>
	{	const req = new SuperRequest('https://example.com/test', {method: 'PUT', headers: {'Content-Type': 'application/json'}});
		assertEquals(req.method, 'PUT');
		assertEquals(req.headers.get('content-type'), 'application/json');
	}
);

Deno.test
(	'SuperRequest - constructor with string body',
	async () =>
	{	const req = new SuperRequest('https://example.com/test', {method: 'POST', body: 'test body'});
		const text = await req.text();
		assertEquals(text, 'test body');
	}
);

Deno.test
(	'SuperRequest - constructor with URLSearchParams body',
	async () =>
	{	const params = new URLSearchParams({key: 'value', foo: 'bar'});
		const req = new SuperRequest('https://example.com/test', {method: 'POST', body: params});
		const text = await req.text();
		assertEquals(text, 'key=value&foo=bar');
	}
);

Deno.test
(	'SuperRequest - constructor with ArrayBuffer body',
	async () =>
	{	const buffer = encoder.encode('buffer data').buffer;
		const req = new SuperRequest('https://example.com/test', {method: 'POST', body: buffer});
		const text = await req.text();
		assertEquals(text, 'buffer data');
	}
);

Deno.test
(	'SuperRequest - constructor with Uint8Array body',
	async () =>
	{	const data = encoder.encode('uint8 data');
		const req = new SuperRequest('https://example.com/test', {method: 'POST', body: data});
		const text = await req.text();
		assertEquals(text, 'uint8 data');
	}
);

Deno.test
(	'SuperRequest - constructor with Blob body',
	async () =>
	{	const blob = new Blob(['blob data'], {type: 'text/plain'});
		const req = new SuperRequest('https://example.com/test', {method: 'POST', body: blob});
		const text = await req.text();
		assertEquals(text, 'blob data');
	}
);

Deno.test
(	'SuperRequest - constructor with FormData body',
	async () =>
	{	const formData = new FormData;
		formData.append('field1', 'value1');
		formData.append('field2', 'value2');
		const req = new SuperRequest('https://example.com/test', {method: 'POST', body: formData});
		const fd = await req.formData();
		assertEquals(fd.get('field1'), 'value1');
		assertEquals(fd.get('field2'), 'value2');
	}
);

Deno.test
(	'SuperRequest - constructor with ReadableStream body',
	async () =>
	{	const stream = new ReadableStream<Uint8Array<ArrayBuffer>>
		(	{	start(controller)
				{	controller.enqueue(encoder.encode('stream data'));
					controller.close();
				}
			}
		);
		const req = new SuperRequest('https://example.com/test', {method: 'POST', body: stream});
		const text = await req.text();
		assertEquals(text, 'stream data');
	}
);

Deno.test
(	'SuperRequest - constructor with Reader body',
	async () =>
	{	const data = encoder.encode('reader data');
		let offset = 0;
		const reader =
		{	read(buffer: Uint8Array)
			{	const n = Math.min(buffer.length, data.length - offset);
				buffer.set(data.subarray(offset, offset + n));
				offset += n;
				return n;
			}
		};
		const req = new SuperRequest('https://example.com/test', {method: 'POST', body: reader});
		const text = await req.text();
		assertEquals(text, 'reader data');
	}
);

Deno.test
(	'SuperRequest - constructor with signal',
	() =>
	{	const controller = new AbortController;
		const req = new SuperRequest('https://example.com/test', {signal: controller.signal});
		assert(req.signal, 'Request should have a signal');
		assertEquals(req.signal.aborted, false);
	}
);

Deno.test
(	'SuperRequest - constructor with aborted signal',
	() =>
	{	const controller = new AbortController;
		controller.abort();
		const req = new SuperRequest('https://example.com/test', {signal: controller.signal});
		assert(req.signal, 'Request should have a signal');
		assertEquals(req.signal.aborted, true);
	}
);

Deno.test
(	'SuperRequest - constructor inherits signal from Request',
	() =>
	{	const controller = new AbortController;
		const originalReq = new Request('https://example.com/test', {signal: controller.signal});
		const req = new SuperRequest(originalReq);
		assert(req.signal, 'Request should have a signal');
		assertEquals(req.signal.aborted, false);
	}
);

Deno.test
(	'SuperRequest - constructor with signal that gets aborted',
	async () =>
	{	const controller = new AbortController;
		const req = new SuperRequest('https://example.com/test', {signal: controller.signal});
		assertEquals(req.signal.aborted, false);

		// Abort the signal
		controller.abort();

		// Give it a moment to propagate
		await new Promise(resolve => setTimeout(resolve, 10));
		assertEquals(req.signal.aborted, true);
	}
);

Deno.test
(	'SuperRequest - signal aborts reading body stream',
	async () =>
	{	const controller = new AbortController;

		// Create a stream that yields data slowly
		let timeoutId: number | undefined;
		let resolveTimeout: (() => void) | undefined;
		const stream = new ReadableStream<Uint8Array>
		(	{	async pull(ctrl)
				{	const promise = new Promise<void>
					(	resolve =>
						{	resolveTimeout = resolve;
							timeoutId = setTimeout(resolve, 50);
						}
					);
					await promise;
					ctrl.enqueue(encoder.encode('chunk'));
				},
				cancel()
				{	if (timeoutId !== undefined)
					{	clearTimeout(timeoutId);
						resolveTimeout?.();
					}
				}
			}
		);

		const req = new SuperRequest
		(	'https://example.com/test',
			{	method: 'POST',
				body: stream,
				signal: controller.signal,
			}
		);

		// Start reading the body
		const bodyStream = req.body;
		assert(bodyStream, 'Body stream should exist');
		const reader = bodyStream.getReader();

		// Read first chunk
		const result1 = await reader.read();
		assert(!result1.done, 'Should have read first chunk');

		// Abort the signal while reading
		controller.abort();

		// Try to read more - should fail
		let error: Error | undefined;
		try
		{	await reader.read();
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		finally
		{	reader.releaseLock();
		}

		assert(error, 'Reading should throw an error after abort');
		assert(error instanceof CancelError, `Expected abort error, got: ${error.name} - ${error.message}`);
	}
);

Deno.test
(	'SuperRequest - signal aborts text() method',
	async () =>
	{	const controller = new AbortController;

		// Use a simple string body for this test
		const req = new SuperRequest
		(	'https://example.com/test',
			{	method: 'POST',
				body: 'test data',
				signal: controller.signal,
			}
		);

		// Abort immediately
		controller.abort();

		// Try to read text - should fail
		let error: Error | undefined;
		try
		{	await req.text();
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}

		assert(error, 'text() should throw an error after abort');
		assert(error instanceof CancelError, `Expected abort error, got: ${error.name} - ${error.message}`);
	}
);

// ============================================================================
// Property Tests
// ============================================================================

Deno.test
(	'SuperRequest - urlUrl property',
	() =>
	{	const req = new SuperRequest('https://example.com/test?foo=bar');
		const urlUrl = req.urlUrl;
		assertEquals(urlUrl.href, 'https://example.com/test?foo=bar');
		assertEquals(urlUrl.searchParamsJson?.foo, 'bar');
		assertEquals(req.url, urlUrl.href);
		urlUrl.searchParams.append('baz', 'qux');
		assertEquals(req.url, 'https://example.com/test?foo=bar&baz=qux');
	}
);

Deno.test
(	'SuperRequest - type property without Content-Type header',
	() =>
	{	const req = new SuperRequest('https://example.com/test');
		assertEquals(req.type, '');
	}
);

Deno.test
(	'SuperRequest - type property with Content-Type header',
	() =>
	{	const req = new SuperRequest
		(	'https://example.com/test',
			{	headers: {'Content-Type': 'application/json; charset=utf-8'},
			}
		);
		assertEquals(req.type, 'application/json');
	}
);

Deno.test
(	'SuperRequest - charset property',
	() =>
	{	const req = new SuperRequest
		(	'https://example.com/test',
			{	headers: {'Content-Type': 'text/html; charset=iso-8859-1'},
			}
		);
		assertEquals(req.type, 'text/html');
		assertEquals(req.charset, 'iso-8859-1');
	}
);

Deno.test
(	'SuperRequest - charset property without charset',
	() =>
	{	const req = new SuperRequest
		(	'https://example.com/test',
			{	headers: {'Content-Type': 'application/json'},
			}
		);
		assertEquals(req.charset, undefined);
	}
);

Deno.test
(	'SuperRequest - cookies property',
	() =>
	{	const req = new SuperRequest
		(	'https://example.com/test',
			{	headers: {'Cookie': 'session=abc123; user=john'},
			}
		);
		const cookies = req.cookies;
		assertEquals(cookies.get('session'), 'abc123');
		assertEquals(cookies.get('user'), 'john');
	}
);

Deno.test
(	'SuperRequest - bodyUsed property initially false',
	() =>
	{	const req = new SuperRequest
		(	'https://example.com/test',
			{	method: 'POST',
				body: 'test',
			}
		);
		assertEquals(req.bodyUsed, false);
	}
);

Deno.test
(	'SuperRequest - bodyUsed property true after reading',
	async () =>
	{	const req = new SuperRequest
		(	'https://example.com/test',
			{	method: 'POST',
				body: 'test',
			}
		);
		await req.text();
		assertEquals(req.bodyUsed, true);
	}
);

// ============================================================================
// Body Reading Methods
// ============================================================================

Deno.test
(	'SuperRequest - text() with empty body',
	async () =>
	{	const req = new SuperRequest('https://example.com/test');
		const text = await req.text();
		assertEquals(text, '');
	}
);

Deno.test
(	'SuperRequest - text() with string body',
	async () =>
	{	const req = new SuperRequest
		(	'https://example.com/test',
			{	method: 'POST',
				body: 'Hello World',
			}
		);
		const text = await req.text();
		assertEquals(text, 'Hello World');
	}
);

Deno.test
(	'SuperRequest - text() with charset',
	async () =>
	{	const data = new Uint8Array([0xF1]); // ñ in ISO-8859-1
		const req = new SuperRequest
		(	'https://example.com/test',
			{	method: 'POST',
				headers: {'Content-Type': 'text/plain; charset=iso-8859-1'},
				body: data,
			}
		);
		const text = await req.text();
		assertEquals(text, 'ñ');
	}
);

Deno.test
(	'SuperRequest - bytes() with empty body',
	async () =>
	{	const req = new SuperRequest('https://example.com/test');
		const bytes = await req.bytes();
		assertEquals(bytes.length, 0);
	}
);

Deno.test
(	'SuperRequest - bytes() with string body',
	async () =>
	{	const req = new SuperRequest
		(	'https://example.com/test',
			{	method: 'POST',
				body: 'test',
			}
		);
		const bytes = await req.bytes();
		assertEquals(decoder.decode(bytes), 'test');
	}
);

Deno.test
(	'SuperRequest - arrayBuffer() with empty body',
	async () =>
	{	const req = new SuperRequest('https://example.com/test');
		const buffer = await req.arrayBuffer();
		assertEquals(buffer.byteLength, 0);
	}
);

Deno.test
(	'SuperRequest - arrayBuffer() with string body',
	async () =>
	{	const req = new SuperRequest
		(	'https://example.com/test',
			{	method: 'POST',
				body: 'test data',
			}
		);
		const buffer = await req.arrayBuffer();
		assert(buffer.byteLength >= 9); // May be larger due to underlying buffer
	}
);

Deno.test
(	'SuperRequest - blob() with empty body',
	async () =>
	{	const req = new SuperRequest('https://example.com/test');
		const blob = await req.blob();
		const text = await blob.text();
		assertEquals(text, '');
	}
);

Deno.test
(	'SuperRequest - blob() with string body',
	async () =>
	{	const req = new SuperRequest
		(	'https://example.com/test',
			{	method: 'POST',
				headers: {'Content-Type': 'text/plain'},
				body: 'blob content',
			}
		);
		const blob = await req.blob();
		assertEquals(blob.type, 'text/plain');
		const text = await blob.text();
		assertEquals(text, 'blob content');
	}
);

// ============================================================================
// JSON Method Tests
// ============================================================================

Deno.test
(	'SuperRequest - json() with JSON body',
	async () =>
	{	const obj = {name: 'test', value: 123};
		const req = new SuperRequest
		(	'https://example.com/test',
			{	method: 'POST',
				headers: {'Content-Type': 'application/json'},
				body: JSON.stringify(obj),
			}
		);
		const result = await req.json();
		assertEquals(result, obj);
	}
);

Deno.test
(	'SuperRequest - json() with application/x-www-form-urlencoded',
	async () =>
	{	const req = new SuperRequest
		(	'https://example.com/test',
			{	method: 'POST',
				headers: {'Content-Type': 'application/x-www-form-urlencoded'},
				body: 'name=john&age=30&tags[]=a&tags[]=b',
			}
		);
		const result = await req.json();
		assertEquals(result.name, 'john');
		assertEquals(result.age, '30');
		assertEquals(result.tags, ['a', 'b']);
	}
);

Deno.test
(	'SuperRequest - json() with FormData body',
	async () =>
	{	const formData = new FormData;
		formData.append('field1', 'value1');
		formData.append('field2', 'value2');
		formData.append('items[]', 'a');
		formData.append('items[]', 'b');
		const req = new SuperRequest
		(	'https://example.com/test',
			{	method: 'POST',
				body: formData,
			}
		);
		const result = await req.json();
		assertEquals(result.field1, 'value1');
		assertEquals(result.field2, 'value2');
		assertEquals(result.items, ['a', 'b']);
	}
);

Deno.test
(	'SuperRequest - json() with URLSearchParams body',
	async () =>
	{	const params = new URLSearchParams;
		params.append('key', 'value');
		params.append('arr[]', '1');
		params.append('arr[]', '2');
		const req = new SuperRequest
		(	'https://example.com/test',
			{	method: 'POST',
				body: params,
			}
		);
		const result = await req.json();
		assertEquals(result.key, 'value');
		assertEquals(result.arr, ['1', '2']);
	}
);

// ============================================================================
// FormData Method Tests
// ============================================================================

Deno.test
(	'SuperRequest - formData() with application/x-www-form-urlencoded',
	async () =>
	{	const req = new SuperRequest
		(	'https://example.com/test',
			{	method: 'POST',
				headers: {'Content-Type': 'application/x-www-form-urlencoded'},
				body: 'name=john&age=30',
			}
		);
		const formData = await req.formData();
		assertEquals(formData.get('name'), 'john');
		assertEquals(formData.get('age'), '30');
	}
);

Deno.test
(	'SuperRequest - formData() with FormData body',
	async () =>
	{	const fd = new FormData;
		fd.append('field', 'value');
		const req = new SuperRequest
		(	'https://example.com/test',
			{	method: 'POST',
				body: fd,
			}
		);
		const result = await req.formData();
		assertEquals(result.get('field'), 'value');
	}
);

Deno.test
(	'SuperRequest - formData() with URLSearchParams body',
	async () =>
	{	const params = new URLSearchParams({key: 'value'});
		const req = new SuperRequest
		(	'https://example.com/test',
			{	method: 'POST',
				body: params
			}
		);
		const result = await req.formData();
		assertEquals(result.get('key'), 'value');
	}
);

Deno.test
(	'SuperRequest - formData() with empty body',
	async () =>
	{	const req = new SuperRequest('https://example.com/test');
		const result = await req.formData();
		assertEquals([...result.entries()].length, 0);
	}
);

// ============================================================================
// Files Method Tests
// ============================================================================

Deno.test
(	'SuperRequest - files() with FormData containing files',
	async () =>
	{	const formData = new FormData;
		formData.append('field', 'value');
		formData.append('file1', new File(['content1'], 'file1.txt', {type: 'text/plain'}));
		formData.append('file2', new File(['content2'], 'file2.txt', {type: 'text/plain'}));

		const req = new SuperRequest
		(	'https://example.com/test',
			{	method: 'POST',
				body: formData,
			}
		);

		const files = new Array<{name: string; value: File}>;
		for await (const file of req.files())
		{	files.push(file);
		}

		assertEquals(files.length, 2);
		assertEquals(files[0].name, 'file1');
		assertEquals(files[0].value.name, 'file1.txt');
		assertEquals(files[1].name, 'file2');
		assertEquals(files[1].value.name, 'file2.txt');
	}
);

Deno.test
(	'SuperRequest - files() then formData() with FormData',
	async () =>
	{	const formData = new FormData;
		formData.append('field1', 'value1');
		formData.append('file', new File(['content'], 'test.txt', {type: 'text/plain'}));
		formData.append('field2', 'value2');

		const req = new SuperRequest
		(	'https://example.com/test',
			{	method: 'POST',
				body: formData,
			}
		);

		const files = new Array<{name: string; value: File}>;
		for await (const file of req.files())
		{	files.push(file);
		}

		assertEquals(files.length, 1);

		const fd = await req.formData();
		assertEquals(fd.get('field1'), 'value1');
		assertEquals(fd.get('field2'), 'value2');
		assertEquals(fd.get('file'), null); // Files are not included
	}
);

Deno.test
(	'SuperRequest - files() with no files',
	async () =>
	{	const formData = new FormData;
		formData.append('field', 'value');

		const req = new SuperRequest
		(	'https://example.com/test',
			{	method: 'POST',
				body: formData,
			}
		);

		const files = new Array<{name: string; value: File}>;
		for await (const file of req.files())
		{	files.push(file);
		}

		assertEquals(files.length, 0);
	}
);

// ============================================================================
// Length Limit Tests
// ============================================================================

Deno.test
(	'SuperRequest - lengthLimit with string body under limit',
	async () =>
	{	const req = new SuperRequest
		(	'https://example.com/test',
			{method: 'POST', body: 'test'},
			{lengthLimit: 10}
		);
		const text = await req.text();
		assertEquals(text, 'test');
	}
);

Deno.test
(	'SuperRequest - lengthLimit with string body over limit',
	async () =>
	{	const req = new SuperRequest
		(	'https://example.com/test',
			{method: 'POST', body: 'this is a long string'},
			{lengthLimit: 10}
		);
		let error: Error | undefined;
		try
		{	await req.text();
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assert(error instanceof TooBigError);
	}
);

Deno.test
(	'SuperRequest - lengthLimit with stream body over limit',
	async () =>
	{	const stream = RdStream.from([encoder.encode('this is a very long stream content')]);
		const req = new SuperRequest
		(	'https://example.com/test',
			{method: 'POST', body: stream},
			{lengthLimit: 10}
		);
		let error: Error | undefined;
		try
		{	await req.text();
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assert(error);
		assert(error.message.includes('too large'));
	}
);

Deno.test
(	'SuperRequest - lengthLimit with Reader body over limit',
	async () =>
	{	const data = encoder.encode('this is long content');
		let offset = 0;
		const reader =
		{	read(buffer: Uint8Array)
			{	const n = Math.min(buffer.length, data.length - offset);
				buffer.set(data.subarray(offset, offset + n));
				offset += n;
				return n;
			}
		};
		const req = new SuperRequest
		(	'https://example.com/test',
			{method: 'POST', body: reader},
			{lengthLimit: 10}
		);
		let error: Error | undefined;
		try
		{	await req.text();
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assert(error instanceof TooBigError);
	}
);

// ============================================================================
// Edge Cases and Integration Tests
// ============================================================================

Deno.test
(	'SuperRequest - body property returns stream',
	() =>
	{	const req = new SuperRequest
		(	'https://example.com/test',
			{	method: 'POST',
				body: 'test',
			}
		);
		const body = req.body;
		assert(body instanceof ReadableStream);
	}
);

Deno.test
(	'SuperRequest - body property null for empty body',
	() =>
	{	const req = new SuperRequest('https://example.com/test');
		const body = req.body;
		assertEquals(body, null);
	}
);

Deno.test
(	'SuperRequest - multiple property accesses work',
	() =>
	{	const req = new SuperRequest
		(	'https://example.com/test',
			{	headers: {'Content-Type': 'application/json; charset=utf-8'},
			}
		);
		assertEquals(req.type, 'application/json');
		assertEquals(req.type, 'application/json'); // Second access
		assertEquals(req.charset, 'utf-8');
		assertEquals(req.charset, 'utf-8'); // Second access
	}
);

Deno.test
(	'SuperRequest - urlUrl property caching',
	() =>
	{	const req = new SuperRequest('https://example.com/test');
		const url1 = req.urlUrl;
		const url2 = req.urlUrl;
		assert(url1 === url2); // Same object
	}
);

Deno.test
(	'SuperRequest - cookies property caching',
	() =>
	{	const req = new SuperRequest
		(	'https://example.com/test',
			{	headers: {'Cookie': 'test=value'},
			}
		);
		const cookies1 = req.cookies;
		const cookies2 = req.cookies;
		assert(cookies1 === cookies2); // Same object
	}
);

Deno.test
(	'SuperRequest - large body',
	async () =>
	{	const largeData = 'x'.repeat(100000);
		const req = new SuperRequest
		(	'https://example.com/test',
			{	method: 'POST',
				body: largeData,
			}
		);
		const text = await req.text();
		assertEquals(text.length, 100000);
	}
);

Deno.test
(	'SuperRequest - chunked stream body',
	async () =>
	{	const chunks = ['Hello', ' ', 'World'];
		let index = 0;
		const stream = new ReadableStream<Uint8Array<ArrayBuffer>>
		(	{	pull(controller)
				{	if (index < chunks.length)
					{	controller.enqueue(encoder.encode(chunks[index++]));
					}
					else
					{	controller.close();
					}
				}
			}
		);
		const req = new SuperRequest
		(	'https://example.com/test',
			{	method: 'POST',
				body: stream,
			}
		);
		const text = await req.text();
		assertEquals(text, 'Hello World');
	}
);

Deno.test
(	'SuperRequest - headers are preserved',
	() =>
	{	const req = new SuperRequest
		(	'https://example.com/test',
			{	headers:
				{	'X-Custom-Header': 'value',
					'Content-Type': 'application/json',
				}
			}
		);
		assertEquals(req.headers.get('x-custom-header'), 'value');
		assertEquals(req.headers.get('content-type'), 'application/json');
	}
);

Deno.test
(	'SuperRequest - method is preserved',
	() =>
	{	const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
		for (const method of methods)
		{	const req = new SuperRequest('https://example.com/test', {method});
			assertEquals(req.method, method);
		}
	}
);

Deno.test
(	'SuperRequest - URL with query parameters',
	() =>
	{	const req = new SuperRequest('https://example.com/test?foo=bar&baz=qux');
		assertEquals(req.url, 'https://example.com/test?foo=bar&baz=qux');
		assertEquals(req.urlUrl.searchParamsJson?.foo, 'bar');
		assertEquals(req.urlUrl.searchParamsJson?.baz, 'qux');
	}
);

Deno.test
(	'SuperRequest - Content-Type case insensitive',
	() =>
	{	const req = new SuperRequest
		(	'https://example.com/test',
			{	headers: {'content-TYPE': 'TEXT/HTML; CHARSET=UTF-8'},
			}
		);
		assertEquals(req.type, 'text/html'); // Lowercased
		assertEquals(req.charset, 'UTF-8'); // Preserved case
	}
);

Deno.test
(	'SuperRequest - empty FormData',
	async () =>
	{	const formData = new FormData;
		const req = new SuperRequest
		(	'https://example.com/test',
			{	method: 'POST',
				body: formData,
			}
		);
		const result = await req.formData();
		assertEquals([...result.entries()].length, 0);
	}
);

Deno.test
(	'SuperRequest - empty URLSearchParams',
	async () =>
	{	const params = new URLSearchParams;
		const req = new SuperRequest
		(	'https://example.com/test',
			{	method: 'POST',
				body: params,
			}
		);
		const text = await req.text();
		assertEquals(text, '');
	}
);

Deno.test
(	'SuperRequest - ArrayBuffer body',
	async () =>
	{	const buffer = new ArrayBuffer(10);
		const view = new Uint8Array(buffer);
		view.set([72, 101, 108, 108, 111]); // "Hello"
		const req = new SuperRequest
		(	'https://example.com/test',
			{	method: 'POST',
				body: buffer,
			}
		);
		const text = await req.text();
		assert(text.startsWith('Hello'));
	}
);

Deno.test
(	'SuperRequest - Reader with close method',
	async () =>
	{	const data = encoder.encode('data');
		let offset = 0;
		let closed = false;
		const reader =
		{	read(buffer: Uint8Array)
			{	const n = Math.min(buffer.length, data.length - offset);
				buffer.set(data.subarray(offset, offset + n));
				offset += n;
				return n;
			},
			close()
			{	closed = true;
			}
		};
		const req = new SuperRequest
		(	'https://example.com/test',
			{	method: 'POST',
				body: reader,
			}
		);
		await req.text();
		assert(closed);
	}
);

Deno.test
(	'SuperRequest - async iterable body',
	async () =>
	{	async function* generate()
		{	yield encoder.encode('Hello ');
			yield encoder.encode('World');
		}
		const req = new SuperRequest
		(	'https://example.com/test',
			{	method: 'POST',
				body: generate(),
			}
		);
		const text = await req.text();
		assertEquals(text, 'Hello World');
	}
);
