import React from 'react';
import fs from 'fs'
import path from 'path';
import os from 'os'
import { build, BuildOptions } from "esbuild";
import { Options, Updates } from "../main";
import { addGTIdentifier, calculateHash, extractEntryMetadata, flattenDictionary, writeChildrenAsObjects } from 'gt-react/internal';
import { splitStringToContent } from 'generaltranslation';

export default async function createInlineUpdates(
    options: Options, 
    esbuildConfig: BuildOptions
): Promise<Updates> {

    const updates: Updates = [];

    return updates;
}