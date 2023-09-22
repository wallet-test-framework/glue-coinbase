#!/usr/bin/env node
import { mainSync } from "./index.js";
import * as process from "node:process";

mainSync(process.argv);
