/**	Represents a URL search parameter value, which can be a string, an object with SearchParam values, or an array of SearchParams.
	This type supports nested structures like `{items: {a: {b: ["val0", "val1"]}}}`.
 **/
export type SearchParam = string | {[key: string]: SearchParam} | SearchParam[];

/**	This class extends the standard URL class by adding a `searchParamsJson` property,
	which contains the parsed URL parameters as a JavaScript object.
 **/
export class SuperUrl extends URL
{	#json: Record<string, SearchParam>|undefined;
	#jsonFor: string|undefined;

	/**	Returns the URL search parameters parsed into a JavaScript object.

		For example, "a=1&b=2" will be parsed as `{a: "1", b: "2"}`.

		The parsing algorithm also supports array and object notation similar to how PHP parses it's query string.

		To get an array, use the `[]` suffix. For example, "items[]=a&items[]=b" will be parsed as `{items: ["a", "b"]}`.
		Also "items[0]=a&items[1]=b" will give the same result.

		To get an object, use the `[key]` notation. For example, "items[a]=1&items[b]=2" will be parsed as `{items: {a: "1", b: "2"}}`.

		Objects and arrays can be nested. For example, "items[a][b][]=val0&items[a][b][]=val1" will be parsed as `{items: {a: {b: ["val0", "val1"]}}}`.

		```ts
		// To run this example:
		// deno run example.ts

		import {SuperUrl} from '../mod.ts';
		import {assertEquals} from 'jsr:@std/assert@1.0.15/equals';

		const url = new SuperUrl('https://example.com/path?id=1&items[]=a&items[]=b&user[profile][name]=John');
		const {id, items, user} = url.searchParamsJson;

		assertEquals(id, '1');
		assertEquals(items, ['a', 'b']);
		assertEquals(user, {profile: {name: 'John'}});
		```
	 **/
	get searchParamsJson()
	{	const queryString = this.search;
		if (this.#jsonFor !== queryString)
		{	this.#jsonFor = queryString;
			this.#json = parseSearchParamsJson(this.searchParams);
		}
		return this.#json!;
	}
}

function parseSearchParamsJson(searchParams: URLSearchParams)
{	const obj: Record<string, SearchParam> = {};
	for (const [name, value] of searchParams)
	{	setSearchParamJson(obj, name, value);
	}
	return obj;
}

/**	Sets a value in a SearchParam object by following a path specified in the name parameter.

	If the name contains array notation like "items[]" or "items[0]", or object notation like "items[a][b]",
	this function creates the necessary nested structure and sets the value at the specified path.
	The algorithm is similar to how PHP parses query string parameters.

	@param obj The target object to set the value in
	@param name The parameter name, potentially with array/object notation (e.g., "items[a][b]" or "items[]")
	@param value The string value to set
	@returns `true` if the name was well-formed, `false` if there were syntax issues
 **/
export function setSearchParamJson(obj: Record<string, SearchParam>, name: string, value: string)
{	let pos = name.indexOf('[');
	if (pos == -1)
	{	obj[name] = value;
		return true;
	}
	let map: {[key: string]: SearchParam} | SearchParam[] = obj;
	let sub: string|number = name.slice(0, pos);
	let ok = true;
	while (true)
	{	let pos2 = name.indexOf(']', ++pos);
		if (pos2 == -1)
		{	ok = false;
			break;
		}
		const nextMap: SearchParam = Array.isArray(map) ? map[Number(sub)] : map[sub+''];
		const nextSub: string|number =
		(	pos != pos2 ?
				name.slice(pos, pos2) :
			typeof(nextMap) != 'object' ?
				0 :
			Array.isArray(nextMap) ?
				nextMap.length :
				Object.keys(nextMap).length+''
		);
		const nextMapConv: {[key: string]: SearchParam} | SearchParam[] =
		(	Array.isArray(nextMap) && nextSub!==nextMap.length ?
				Object.fromEntries(nextMap.map((item, index) => [index+'', item])) : // convert array to object
			typeof(nextMap) == 'object' ?
				nextMap :
			nextSub === 0 ?
				[] : // convert string or undefined to array
				{} // convert string or undefined to object
		);
		if (nextMap != nextMapConv)
		{	(map as Record<string|number, SearchParam>)[sub] = nextMapConv;
		}
		map = nextMapConv;
		sub = nextSub;
		if (name.charAt(++pos2) != '[')
		{	break;
		}
		pos = pos2;
	}
	(map as Record<string|number, SearchParam>)[sub] = value;
	return ok;
}
