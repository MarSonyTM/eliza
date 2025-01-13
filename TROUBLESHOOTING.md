# Troubleshooting Guide

## Character Loading Issues

If you're having trouble loading a different character (e.g., stuck with Eliza), follow these steps:

1. First, ensure your character file is properly configured:

    - Check that the character file exists in the `characters/` directory
    - Make sure the model settings match your environment:

    ```json
    {
        "modelProvider": "llama_local",
        "characterModelProvider": "llama_local",
        "modelType": "llama_local",
        "characterModelType": "llama_local",
        "settings": {
            "model": "hermes" // Note: this should be a string, not an object
        }
    }
    ```

2. Update your `.env` file to use the desired character:

    ```env
    # Character Configuration
    ELIZA_CHARACTER=your_character_name
    DEFAULT_CHARACTER=your_character_name
    ACTIVE_CHARACTER=your_character_name
    ```

3. Clean and rebuild the project:

    ```bash
    pnpm clean
    pnpm build
    ```

4. Start the agent with explicit character specification:

    ```bash
    pnpm start --characters="characters/your_character.character.json"
    ```

5. In a new terminal, start the client:
    ```bash
    pnpm start:client
    ```

## Common Issues and Solutions

1. If you see "Eliza" instead of your character:

    - Make sure to specify the character explicitly using `--characters` flag
    - Check that your character file has the correct model configuration

2. If you get model validation errors:

    - Ensure the `settings.model` is a string, not an object
    - Example: `"model": "hermes"` instead of `"model": { "name": "hermes" }`

3. If the character file isn't found:
    - Verify the path is correct (should be in `characters/` directory)
    - Make sure the filename ends with `.character.json`

## Example Working Character Configuration

Here's an example of a working character configuration (C3PO):

```json
{
    "name": "C-3PO",
    "clients": [],
    "modelProvider": "llama_local",
    "characterModelProvider": "llama_local",
    "modelType": "llama_local",
    "characterModelType": "llama_local",
    "settings": {
        "voice": {
            "model": "en_GB-alan-medium"
        },
        "model": "hermes"
    },
    "plugins": []
    // ... rest of character configuration ...
}
```

Remember to always restart both the agent and client processes after making changes to character configurations.
