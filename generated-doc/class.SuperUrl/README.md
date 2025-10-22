# `class` SuperUrl `extends` URL

[Documentation Index](../README.md)

```ts
import {SuperUrl} from "jsr:@shaulov/super-request@0.1.1"
```

This class extends the standard URL class by adding a `searchParamsJson` property,
which contains the parsed URL parameters as a JavaScript object.

## This class has

- [constructor](#-constructorurl-string--url-base-string--url)
- property [searchParamsJson](#-get-searchparamsjson-record)
- base class


#### 🔧 `constructor`(url: `string` | URL, base?: `string` | URL)

> Creates a new URL object by parsing the specified URL string with an optional base URL.
> Throws a TypeError If the URL is invalid or if a relative URL is provided without a base.
> 
> Use this to parse and validate URLs safely. Use this instead of string
> manipulation to ensure correct URL handling, proper encoding, and protection against
> security issues like path traversal attacks.



#### 📄 `get` searchParamsJson(): Record

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



