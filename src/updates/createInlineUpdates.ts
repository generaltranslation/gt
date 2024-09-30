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

    // Looks for "src", "app" folders, otherwise goes from root and looks at all folders not beginning ".", not "node_modules", and not in ".gitignore"
    // Find the files mentioning gt-next or gt-react
    // Not foolproof but good enough

    // Find <T> components within those
    
    // Extract { id, context, singular, plural, dual, zero, one, two, few, many, other }
    // Skip to the next tag if id is variable or blank, assume the user knows what they're doing

    // Write new temporary dictionary file with just one id, with, context, branches etc.

    // ESBuild that dictionary

    // Create an update for that dictionary's entry

    // Repeat

    return updates;
}