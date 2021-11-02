const TerserPlugin = require("terser-webpack-plugin")
const { CleanWebpackPlugin } = require("clean-webpack-plugin")
const path = require("path")

module.exports = {
  mode: "production",
  entry: path.join(__dirname, "./src/index.js"),
  output: {
    filename: "cake-util.min.js",
    path: path.join(__dirname, "./dist"),
    library: "cake_util",
    libraryTarget: "umd",
  },
  resolve: {
    extensions: [".", ".ts", ".js", ".json"],
  },
  module: {
    rules: [
      {
        test: /\.(js)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
        },
      },
    ],
  },
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin()],
  },
  plugins: [new CleanWebpackPlugin()],
}
