const path = require("path");

module.exports = {
  entry: "./index.js", 
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "index.umd.js",
    library: "itp", 
    libraryTarget: "umd", 
    globalObject: "this",
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env"],
          },
        },
      },
    ],
  },
  mode: "production",
};
