import {SuperUrl} from '../super_url.ts';
import {assertEquals, assert} from './deps.ts';

Deno.test
(	'URL searchParamsJson basic functionality',
	() =>
	{	const url = new SuperUrl('https://example.com/path?query-1=a&query-2=b');

		assertEquals(url.searchParams.get('query-1'), 'a');
		assertEquals(url.searchParamsJson, {'query-1': 'a', 'query-2': 'b'});

		url.searchParams.set('query-1', 'aa');

		assertEquals(url.searchParams.get('query-1'), 'aa');
		assertEquals(url.search, '?query-1=aa&query-2=b');
		assertEquals(url.searchParamsJson, {'query-1': 'aa', 'query-2': 'b'});
		assertEquals(url+'', 'https://example.com/path?query-1=aa&query-2=b');
	}
);

Deno.test
(	'Array notation with empty brackets',
	() =>
	{	const url = new SuperUrl('https://example.com/?items[]=a&items[]=b&items[]=c');
		assertEquals(url.searchParamsJson, {items: ['a', 'b', 'c']});
	}
);

Deno.test
(	'Array notation with indices',
	() =>
	{	const url = new SuperUrl('https://example.com/?items[0]=a&items[1]=b&items[2]=c');
		// Numeric indices create an object, not an array
		assertEquals(url.searchParamsJson, {items: {'0': 'a', '1': 'b', '2': 'c'}});
	}
);

Deno.test
(	'Array notation with non-sequential indices',
	() =>
	{	const url = new SuperUrl('https://example.com/?items[0]=a&items[2]=c&items[1]=b');
		// Non-sequential indices create an object
		assertEquals(url.searchParamsJson, {items: {'0': 'a', '2': 'c', '1': 'b'}});
	}
);

Deno.test
(	'Object notation',
	() =>
	{	const url = new SuperUrl('https://example.com/?items[a]=1&items[b]=2&items[c]=3');
		assertEquals(url.searchParamsJson, {items: {a: '1', b: '2', c: '3'}});
	}
);

Deno.test
(	'Nested object notation',
	() =>
	{	const url = new SuperUrl('https://example.com/?items[a][x]=1&items[a][y]=2&items[b][z]=3');
		assertEquals(url.searchParamsJson, {items: {a: {x: '1', y: '2'}, b: {z: '3'}}});
	}
);

Deno.test
(	'Nested array notation',
	() =>
	{	const url = new SuperUrl('https://example.com/?items[a][b][]=val0&items[a][b][]=val1');
		assertEquals(url.searchParamsJson, {items: {a: {b: ['val0', 'val1']}}});
	}
);

Deno.test
(	'Mixed nested structures',
	() =>
	{	const url = new SuperUrl('https://example.com/?data[users][0][name]=John&data[users][0][age]=30&data[users][1][name]=Jane&data[users][1][age]=25');
		// Numeric indices create objects
		assertEquals
		(	url.searchParamsJson,
			{	data:
				{	users:
					{	'0': {name: 'John', age: '30'},
						'1': {name: 'Jane', age: '25'}
					}
				}
			}
		);
	}
);

Deno.test
(	'Empty parameter value',
	() =>
	{	const url = new SuperUrl('https://example.com/?key=&other=value');
		assertEquals(url.searchParamsJson, {key: '', other: 'value'});
	}
);

Deno.test
(	'Parameter without value',
	() =>
	{	const url = new SuperUrl('https://example.com/?key&other=value');
		assertEquals(url.searchParamsJson, {key: '', other: 'value'});
	}
);

Deno.test
(	'URL encoded characters',
	() =>
	{	const url = new SuperUrl('https://example.com/?name=John%20Doe&email=user%40example.com');
		assertEquals(url.searchParamsJson, {name: 'John Doe', email: 'user@example.com'});
	}
);

Deno.test
(	'Special characters in array',
	() =>
	{	const url = new SuperUrl('https://example.com/?items[]=a%20b&items[]=c%26d&items[]=e%3Df');
		assertEquals(url.searchParamsJson, {items: ['a b', 'c&d', 'e=f']});
	}
);

Deno.test
(	'Empty query string',
	() =>
	{	const url = new SuperUrl('https://example.com/');
		assertEquals(url.searchParamsJson, {});
	}
);

Deno.test
(	'Single parameter',
	() =>
	{	const url = new SuperUrl('https://example.com/?single=value');
		assertEquals(url.searchParamsJson, {single: 'value'});
	}
);

Deno.test
(	'Array to object conversion',
	() =>
	{	const url = new SuperUrl('https://example.com/?items[]=a&items[]=b&items[5]=x');
		assertEquals(url.searchParamsJson, {items: {'0': 'a', '1': 'b', '5': 'x'}});
	}
);

Deno.test
(	'Overwriting simple value with object',
	() =>
	{	const url = new SuperUrl('https://example.com/?item=simple&item[key]=value');
		assertEquals(url.searchParamsJson, {item: {key: 'value'}});
	}
);

Deno.test
(	'Overwriting simple value with array',
	() =>
	{	const url = new SuperUrl('https://example.com/?item=simple&item[]=value');
		assertEquals(url.searchParamsJson, {item: ['value']});
	}
);

Deno.test
(	'Complex nested structure',
	() =>
	{	const url = new SuperUrl('https://example.com/?a[b][c][d]=1&a[b][c][e]=2&a[b][f][]=3&a[b][f][]=4');
		assertEquals
		(	url.searchParamsJson,
			{	a:
				{	b:
					{	c: {d: '1', e: '2'},
						f: ['3', '4']
					}
				}
			}
		);
	}
);

Deno.test
(	'Multiple separate arrays',
	() =>
	{	const url = new SuperUrl('https://example.com/?arr1[]=a&arr1[]=b&arr2[]=x&arr2[]=y');
		assertEquals(url.searchParamsJson, {arr1: ['a', 'b'], arr2: ['x', 'y']});
	}
);

Deno.test
(	'searchParamsJson caching',
	() =>
	{	const url = new SuperUrl('https://example.com/?a=1&b=2');
		const json1 = url.searchParamsJson;
		const json2 = url.searchParamsJson;
		assertEquals(json1, json2);
		assert(json1 === json2); // Same object reference

		// Modify search params
		url.searchParams.set('c', '3');
		const json3 = url.searchParamsJson;
		assert(json1 !== json3); // Different object reference after change
		assertEquals(json3, {a: '1', b: '2', c: '3'});
	}
);

Deno.test
(	'Empty brackets at different nesting levels',
	() =>
	{	const url = new SuperUrl('https://example.com/?a[][]=1&a[][]=2&a[][]=3&a[][]=4');
		assertEquals(url.searchParamsJson, {a: [['1'], ['2'], ['3'], ['4']]});
	}
);

Deno.test
(	'Numeric string keys',
	() =>
	{	const url = new SuperUrl('https://example.com/?items[0]=a&items[1]=b&items[foo]=c');
		assertEquals(url.searchParamsJson, {items: {'0': 'a', '1': 'b', 'foo': 'c'}});
	}
);

Deno.test
(	'URL with fragment and search params',
	() =>
	{	const url = new SuperUrl('https://example.com/path?key=value#fragment');
		assertEquals(url.searchParamsJson, {key: 'value'});
		assertEquals(url.hash, '#fragment');
	}
);

Deno.test
(	'Duplicate simple keys',
	() =>
	{	const url = new SuperUrl('https://example.com/?key=value1&key=value2');
		// Last value wins for simple keys
		assertEquals(url.searchParamsJson, {key: 'value2'});
	}
);

Deno.test
(	'Empty array notation',
	() =>
	{	const url = new SuperUrl('https://example.com/?items[]');
		assertEquals(url.searchParamsJson, {items: ['']});
	}
);

Deno.test
(	'Malformed bracket notation',
	() =>
	{	const url = new SuperUrl('https://example.com/?items[unclosed=value&other=test');
		// Malformed brackets are treated as creating a simple property "items"
		assertEquals(url.searchParamsJson, {items: 'value', other: 'test'});
	}
);

Deno.test
(	'Very deeply nested structure',
	() =>
	{	const url = new SuperUrl('https://example.com/?a[b][c][d][e][f]=deep');
		assertEquals(url.searchParamsJson, {a: {b: {c: {d: {e: {f: 'deep'}}}}}});
	}
);

Deno.test
(	'Array with gaps converted to object',
	() =>
	{	const url = new SuperUrl('https://example.com/?items[]=a&items[]=b&items[10]=z');
		// Array with a gap is converted to object
		assertEquals(url.searchParamsJson, {items: {'0': 'a', '1': 'b', '10': 'z'}});
	}
);

Deno.test
(	'Plus sign in query',
	() =>
	{	const url = new SuperUrl('https://example.com/?name=John+Doe=%66');
		assertEquals(url.searchParamsJson, {name: 'John Doe=f'});
	}
);

Deno.test
(	'Special characters in keys',
	() =>
	{	const url = new SuperUrl('https://example.com/?key-with-dash=1&key.with.dot=2&key_with_underscore=3');
		assertEquals(url.searchParamsJson, {'key-with-dash': '1', 'key.with.dot': '2', 'key_with_underscore': '3'});
	}
);

Deno.test
(	'Empty object key',
	() =>
	{	const url = new SuperUrl('https://example.com/?items[]=value');
		assertEquals(url.searchParamsJson, {items: ['value']});
	}
);

Deno.test
(	'Mixing arrays and simple values',
	() =>
	{	const url = new SuperUrl('https://example.com/?a=simple&b[]=array1&b[]=array2&c=simple2');
		assertEquals(url.searchParamsJson, {a: 'simple', b: ['array1', 'array2'], c: 'simple2'});
	}
);

Deno.test
(	'Unicode characters',
	() =>
	{	const url = new SuperUrl('https://example.com/?name=%E4%BD%A0%E5%A5%BD&emoji=%F0%9F%98%80');
		assertEquals(url.searchParamsJson, {name: '你好', emoji: '😀'});
	}
);

Deno.test
(	'Empty nested array',
	() =>
	{	const url = new SuperUrl('https://example.com/?items[a][]=');
		assertEquals(url.searchParamsJson, {items: {a: ['']}});
	}
);

Deno.test
(	'Multiple levels of empty brackets',
	() =>
	{	const url = new SuperUrl('https://example.com/?a[][][]=value');
		assertEquals(url.searchParamsJson, {a: [[['value']]]});
	}
);

Deno.test
(	'Overwriting array with simple value',
	() =>
	{	const url = new SuperUrl('https://example.com/?item[]=a&item[]=b&item=simple');
		assertEquals(url.searchParamsJson, {item: 'simple'});
	}
);

Deno.test
(	'Complex real-world scenario',
	() =>
	{	const url = new SuperUrl('https://example.com/?filter[status]=active&filter[tags][]=urgent&filter[tags][]=bug&sort=date&page=1');
		assertEquals
		(	url.searchParamsJson,
			{	filter: {status: 'active', tags: ['urgent', 'bug']},
				sort: 'date',
				page: '1'
			}
		);
	}
);

Deno.test
(	'Query string with only ampersands',
	() =>
	{	const url = new SuperUrl('https://example.com/?&&&');
		assertEquals(url.searchParamsJson, {});
	}
);

Deno.test
(	'Mixed bracket styles',
	() =>
	{	const url = new SuperUrl('https://example.com/?data[users][]=John&data[users][]=Jane&data[count]=2');
		assertEquals(url.searchParamsJson, {data: {users: ['John', 'Jane'], count: '2'}});
	}
);

Deno.test
(	'Percent-encoded brackets',
	() =>
	{	const url = new SuperUrl('https://example.com/?key%5B0%5D=value');
		assertEquals(url.searchParamsJson, {key: {'0': 'value'}});
	}
);

Deno.test
(	'searchParamsJson updates when URL changes',
	() =>
	{	const url = new SuperUrl('https://example.com/?a=1');
		assertEquals(url.searchParamsJson, {a: '1'});

		url.search = '?b=2';
		assertEquals(url.searchParamsJson, {b: '2'});

		url.searchParams.append('c', '3');
		assertEquals(url.searchParamsJson, {b: '2', c: '3'});
	}
);
