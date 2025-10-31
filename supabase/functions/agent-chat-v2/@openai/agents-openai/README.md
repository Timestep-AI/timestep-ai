# Temporary SDK Files

⚠️ **These files are temporary copies from the OpenAI Agents SDK and should be removed once the library is officially published.**

## Purpose

These files are local copies of internal implementation details from `@openai/agents-openai` that are not yet exported from the npm package. They are needed to support `OpenAIConversationsSession`, which is required for conversation history functionality.

## Files Included

- `memory/openaiConversationsSession.ts` - Main session implementation (not exported from npm)
- `defaults.ts` - Default client and key management
- `openaiResponsesModel.ts` - Response model conversion utilities
- `tools.ts` - Tool status enums and definitions
- `logger.ts` - Logging utilities
- `metadata.ts` - Package metadata
- `utils/providerData.ts` - Provider data utilities
- `types/providerData.ts` - Provider data types

## Replacement Instructions

Once `@openai/agents-openai` publishes these exports, do the following:

1. Remove this entire `@openai` folder
2. Update `index.ts` to import from the npm package:
   ```typescript
   // Replace this:
   import { OpenAIConversationsSession } from './@openai/agents-openai/memory/openaiConversationsSession.ts';
   
   // With this:
   import { OpenAIConversationsSession } from '@openai/agents-openai/memory';
   ```
3. Verify all functionality still works

## Current Status

- ✅ Conversation history is working
- ✅ Files are organized to match the SDK structure exactly
- ⏳ Waiting for official npm package exports

## Why We Need These Files

`OpenAIConversationsSession` is required for conversation history but is not yet exported from the npm package. It depends on several internal utilities (`defaults.ts`, `openaiResponsesModel.ts`, etc.) which also aren't exported, so we had to copy the entire dependency chain.

