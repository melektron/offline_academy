const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin")

module.exports = {
   mode: "production",
   entry: {
      background: path.resolve(__dirname, "src", "background", "background.ts"),
      netacad_content: path.resolve(__dirname, "src", "netacad_content" , "netacad_content.ts"),
      digi4school_content: path.resolve(__dirname, "src", "digi4school_content" , "digi4school_content.ts"),
      bedienungsanleitungen_content: path.resolve(__dirname, "src", "bedienungsanleitungen_content" , "bedienungsanleitungen_content.ts"),
   },
   output: {
      path: path.join(__dirname, "dist"),
      filename: "[name].js",
   },
   resolve: {
      // to support imports relative to src/ (note that "baseUrl" in tsconfig.json must also be set to "src")
      // https://betterprogramming.pub/the-right-usage-of-aliases-in-webpack-typescript-4418327f47fa
      modules: [path.resolve(__dirname, "src"), "node_modules"],
      extensions: [".tsx", ".ts", ".js", ""],
   },
   module: {
      rules: [
         {
            test: /\.tsx?$/,
            loader: "ts-loader",
            exclude: /node_modules/,
         },
      ],
   },
   plugins: [
      new CopyPlugin({
         patterns: [{from: ".", to: ".", context: "public"}]
      }),
      new NodePolyfillPlugin(),
   ],
};