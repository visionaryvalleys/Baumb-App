import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "@aws-sdk/client-s3", "onnxruntime-node", "sharp"],
  // Lets phones on the same Wi-Fi use the dev server by this PC's LAN address.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
};

export default nextConfig;
