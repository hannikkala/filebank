module.exports = {
  roots: ["<rootDir>"],
  transform: {
    "^.+\\.ts?$": "ts-jest"
  },
  testRegex: "(/__tests__/.*|(\\.|/))test\\.ts?$",
  moduleFileExtensions: ["js", "jsx", "json", "ts", "tsx"],
  testURL: "http://localhost:8000/",
  testEnvironment: "node",
  globals: {
    "ts-jest": {
      isolatedModules: true
    }
  }
};
