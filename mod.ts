/**	# SuperRequest Module

	Provides extended versions of standard web API classes, that simplify web request handling.

	## Classes

	### {@link SuperRequest}
	An extended version of the standard {@link https://developer.mozilla.org/en-US/docs/Web/API/Request Request}
	class with additional features:
	- Configurable maximum request body size limit. Allows to automatically cancel the body stream if the limit is exceeded, and throw error.
	- The object can be constructed from the same body types as regular `Request`, including `ReadableStream`, string, and so on, plus from "Reader" interface (objects, that have a `read(buffer)` method, like `Deno.TcpConn`). This interface is more efficient, because it doesn't require copying data into intermediate buffers.
	- Enhanced request URL accessor via {@link SuperUrl} class, which allows to get URL parameters as a JavaScript object,
	that contains parameter names and values, and the values can be nested arrays and objects.
	Parameter parsing is similar to how PHP parses query strings.
	- "Content-Type" header is parsed to `type` and `charset` (other parameters are ignored, but the full header is still available via `headers` property).
	- "Cookie" header is parsed into a {@link SuperCookies} object, which allows to get, set, and delete cookies,
	and to apply the changes to the "Set-Cookie" headers of an HTTP response.
	- Allows to handle uploaded files found in "multipart/form-data" POST bodies by providing readable streams for each file,
	that read the data directly from the request body without implicitly storing data into memory.
	- `json()` method works not only for "application/json" bodies, but also for "multipart/form-data" and "application/x-www-form-urlencoded" bodies,
	parsing the data into a JavaScript object using the same rules as for URL parameters.
	- `formData()` method works similarly to the standard Request, except that it doesn't include uploaded files in the returned FormData object.
	To handle files, you need to call the {@link files}() method before calling `formData()`.

	### {@link SuperUrl}
	An extended {@link https://developer.mozilla.org/en-US/docs/Web/API/URL URL} class that adds {@link SuperUrl.searchParamsJson searchParamsJson} property
	for parsing URL parameters into JavaScript objects.
	This property supports array notation (e.g., `items[]=a&items[]=b` → `{items: ["a", "b"]}`),
	and object notation (e.g., `user[name]=John&user[age]=25` → `{user: {name: "John", age: "25"}}`).
	It supports nested arrays and objects (e.g., `items[a][b][]=val0&items[a][b][]=val1` → `{items: {a: {b: ["val0", "val1"]}}}`).
	Other properties and methods are the same as in the standard URL class.

	### {@link SuperCookies}
	A Map-based cookie management class that:
	- Parses "Cookie" headers from HTTP requests
	- Allows modification of cookie values (with attributes, like expires, path, domain, etc.)
	- Provides {@link SuperCookies.applyToResponse applyToResponse()} method to set "Set-Cookie" headers on HTTP responses

	### {@link SuperFile} and {@link SuperBlob}
	File and Blob implementations that use ReadableStreams as data sources.

	@module
 **/

export {CancelError} from './private/deps.ts';
export {SuperUrl} from './private/super_url.ts';
export {SuperCookies, type CookieOptions, CookieError} from './private/super_cookies.ts';
export {SuperFile, SuperBlob} from './private/super_file.ts';
export {SuperRequest, type SuperRequestInit, type SuperRequestOptions, TooBigError} from './private/super_request.ts';
