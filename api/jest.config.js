module.exports = {
  roots: ["<rootDir>"],
  transform: {
    "^.+\\.ts?$": "ts-jest"
  },
  testRegex: "(/__tests__/.*|(\\.|/))test\\.ts?$",
  moduleFileExtensions: ["js", "jsx", "json", "ts", "tsx"],
  testURL: "http://localhost:8000/",
  testEnvironment: "node",
  collectCoverageFrom: [
    "src/**/*.ts"
  ],
  coveragePathIgnorePatterns: [
    "<rootDir>/node_modules"
  ],
  coverageReporters: [
    "json",
    "lcov",
    "text"
  ],
  coverageThreshold: {
    "global": {
      "branches": 80,
      "functions": 80,
      "lines": 80,
      "statements": 80
    }
  },
  globals: {
    "ts-jest": {
      isolatedModules: true
    }
  }
};
