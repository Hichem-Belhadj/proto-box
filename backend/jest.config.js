const { createDefaultPreset } = require("ts-jest");

createDefaultPreset().transform;

/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/?(*.)+(spec).ts"],
  clearMocks: true,
};