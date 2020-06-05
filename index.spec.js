import { parse } from "./index";

async function loadSanityData() {
  const fs = require('fs').promises;
  const data = await fs.readFile("./samples/sanity.fountain", "utf8");
  return data;
}

describe('parse tests', () => {
  test('sanity', async () => {
    const sample = await loadSanityData();
    const mockCallback = jest.fn((output) => output.tokens);
    parse(sample, mockCallback);
    console.log(mockCallback.mock.results[0].value);
    expect(mockCallback.mock.results[0].value.length).toBe(44);
  });
})