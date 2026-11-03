/**
 * Runtime components whose code reaches a visitor's browser or the server
 * bundle. `third-party.test.ts` keeps this list in step with the
 * `dependencies` of `apps/web/package.json` (names, versions and the licence
 * each package declares), so a new runtime dependency cannot ship without a
 * line on /legal/licenses.
 */
export type ThirdPartyComponent = {
  name: string;
  packages: readonly string[];
  version: string;
  license: string;
  url: string;
};

export const THIRD_PARTY: readonly ThirdPartyComponent[] = [
  {
    name: "Next.js",
    packages: ["next"],
    version: "16.4.3",
    license: "MIT",
    url: "https://github.com/vercel/next.js",
  },
  {
    name: "React, React DOM",
    packages: ["react", "react-dom"],
    version: "19.3.1",
    license: "MIT",
    url: "https://github.com/facebook/react",
  },
  {
    name: "i18next",
    packages: ["i18next"],
    version: "26.5.11",
    license: "MIT",
    url: "https://github.com/i18next/i18next",
  },
  {
    name: "react-i18next",
    packages: ["react-i18next"],
    version: "17.1.9",
    license: "MIT",
    url: "https://github.com/i18next/react-i18next",
  },
  {
    name: "Lucide",
    packages: ["lucide-react"],
    version: "1.64.0",
    license: "ISC",
    url: "https://github.com/lucide-icons/lucide",
  },
  {
    name: "PDF.js",
    packages: ["pdfjs-dist"],
    version: "6.4.299",
    license: "Apache-2.0",
    url: "https://github.com/mozilla/pdf.js",
  },
  {
    name: "OpenCV.js",
    packages: ["@opencvjs/web"],
    version: "5.0.0-release.2",
    license: "Apache-2.0",
    url: "https://github.com/opencv/opencv",
  },
  {
    name: "node-qrcode",
    packages: ["qrcode"],
    version: "1.5.4",
    license: "MIT",
    url: "https://github.com/soldair/node-qrcode",
  },
  {
    name: "Zod",
    packages: ["zod"],
    version: "4.6.7",
    license: "MIT",
    url: "https://github.com/colinhacks/zod",
  },
  {
    name: "heic-to",
    packages: ["heic-to"],
    version: "1.6.7",
    license: "LGPL-3.0",
    url: "https://github.com/hoppergee/heic-to",
  },
  {
    name: "Vercel Blob SDK",
    packages: ["@vercel/blob"],
    version: "2.8.2",
    license: "Apache-2.0",
    url: "https://github.com/vercel/storage",
  },
  {
    name: "Upstash Redis SDK",
    packages: ["@upstash/redis"],
    version: "1.40.0",
    license: "MIT",
    url: "https://github.com/upstash/redis-js",
  },
  {
    name: "Upstash QStash SDK",
    packages: ["@upstash/qstash"],
    version: "2.12.1",
    license: "MIT",
    url: "https://github.com/upstash/qstash-js",
  },
  {
    name: "AWS SDK for JavaScript v3 (S3)",
    packages: ["@aws-sdk/client-s3", "@aws-sdk/s3-request-presigner"],
    version: "3.1160.0",
    license: "Apache-2.0",
    url: "https://github.com/aws/aws-sdk-js-v3",
  },
  {
    name: "node-postgres",
    packages: ["pg"],
    version: "8.23.1",
    license: "MIT",
    url: "https://github.com/brianc/node-postgres",
  },
  {
    name: "node-redis",
    packages: ["redis"],
    version: "6.3.1",
    license: "MIT",
    url: "https://github.com/redis/node-redis",
  },
];
