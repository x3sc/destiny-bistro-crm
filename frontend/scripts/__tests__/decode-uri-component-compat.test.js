const decodeUriComponent = require('decode-uri-component');
const queryString = require('query-string');

describe('decode-uri-component CommonJS compatibility', () => {
  it('exports the callable decoder expected by query-string 7', () => {
    expect(typeof decodeUriComponent).toBe('function');
  });

  it('keeps malformed percent-encoded input bounded and parseable', () => {
    expect(queryString.parse('value=%E0%A4%A')).toEqual({
      value: '%E0%A4%A',
    });
  });

  it('continues decoding valid UTF-8 input', () => {
    expect(queryString.parse('value=caf%C3%A9')).toEqual({
      value: 'café',
    });
  });
});
