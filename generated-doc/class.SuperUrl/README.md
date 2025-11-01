# `class` SuperUrl `extends` URL

[Documentation Index](../README.md)

```ts
import {SuperUrl} from "jsr:@shaulov/super-request@0.1.7"
```

This class extends the standard URL class by adding a `searchParamsJson` property,
which contains the parsed URL parameters as a JavaScript object.

## This class has

- [constructor](#-constructorurl-string--url-base-string--url)
- property [searchParamsJson](#-get-searchparamsjson-recordstring-searchparam)
- base class


#### 🔧 `constructor`(url: `string` | URL, base?: `string` | URL)

> Creates a new URL object by parsing the specified URL string with an optional base URL.
> Throws a TypeError If the URL is invalid or if a relative URL is provided without a base.
> 
> Use this to parse and validate URLs safely. Use this instead of string
> manipulation to ensure correct URL handling, proper encoding, and protection against
> security issues like path traversal attacks.



#### 📄 `get` searchParamsJson(): Record\<`string`, SearchParam>

> Returns the URL search parameters parsed into a JavaScript object.
> 
> For example, "a=1&b=2" will be parsed as `{a: "1", b: "2"}`.
> 
> The parsing algorithm also supports array and object notation similar to how PHP parses it's query string.
> 
> To get an array, use the `[]` suffix. For example, "items[]=a&items[]=b" will be parsed as `{items: ["a", "b"]}`.
> Also "items[0]=a&items[1]=b" will give the same result.
> 
> To get an object, use the `[key]` notation. For example, "items[a]=1&items[b]=2" will be parsed as `{items: {a: "1", b: "2"}}`.
> 
> Objects and arrays can be nested. For example, "items[a][b][]=val0&items[a][b][]=val1" will be parsed as `{items: {a: {b: ["val0", "val1"]}}}`.
> 
> ```ts
> // To download and run this example:
> // curl 'https://raw.githubusercontent.com/jeremiah-shaulov/super-request/0.1.7/generated-doc/class.SuperUrl/README.md' | perl -ne 's/^> //; $y=$1 if /^```(.)?/; print $_ if $y&&$m; $m=$y&&$m+/<example-48ql>/' > /tmp/example-48ql.ts
> // deno run /tmp/example-48ql.ts
> 
> import {SuperUrl} from 'jsr:@shaulov/super-request@0.1.7';
> import {assertEquals} from 'jsr:@std/assert@1.0.15/equals';
> 
> const url = new SuperUrl('https://example.com/path?id=1&items[]=a&items[]=b&user[profile][name]=John');
> const {id, items, user} = url.searchParamsJson;
> 
> assertEquals(id, '1');
> assertEquals(items, ['a', 'b']);
> assertEquals(user, {profile: {name: 'John'}});
> ```



