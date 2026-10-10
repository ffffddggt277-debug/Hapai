import path from 'node:path';import {fileURLToPath} from 'node:url';const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export default {transpilePackages:['@hapai/shared'],poweredByHeader:false,outputFileTracingRoot:root,turbopack:{root}};
