#!/usr/bin/env -S deno run --allow-all

import { gwTool } from './lib/gw-tool.ts';

if (import.meta.main) {
  console.log(gwTool());
}
