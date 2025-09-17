# Configuration

This folder holds the default configurations to be provided as options to the Translations Tab, namely:

- `exportForTranslation`: Process a Sanity document before sending it off to a TMS. By default, the documents will be serialized to HTML: content will be rendered in nested divs in the HTML `body`, and any relevant metadata will be in the HTML `head`. This function should return an object like:

```
{
  name: "Your desired name for this document",
  content: <html>A long HTML string containing my document's values</html>
}
```

For more information on this process, please refer to the [Sanity Naive HTML Serializer](https://github.com/sanity-io/sanity-naive-html-serializer)

- `importTranslation`: Receive a translated document back from a TMS, parse it into a Sanity-readable format, and patch it back to the relevant Sanity document. Again, the [Sanity Naive HTML Serializer](https://github.com/sanity-io/sanity-naive-html-serializer) is used for parsing under the assumption that the file sent over was HTML, but any function could be used here.
