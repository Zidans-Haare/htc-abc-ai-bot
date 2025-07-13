#   vh
#   cd C:\Users\Thomas\web\htc-abc-ai-bot\grok
#   py .\grok_concat.py grok/03_grok.txt
#
#   vh ; cd C:\Users\Thomas\web\htc-abc-ai-bot\scripts ; py .\concat_for_grok.py scripts/grok_02.txt


import os
import pathspec
from pathlib import Path

def load_gitignore_patterns(gitignore_path):
    """Load and parse .gitignore patterns."""
    if not gitignore_path.exists():
        return pathspec.PathSpec.from_lines('gitwildmatch', [])
    
    with open(gitignore_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    return pathspec.PathSpec.from_lines('gitwildmatch', lines)

def load_internal_ignore_patterns():
    """Load internal ignore patterns."""
    internal_patterns = [
        'public/admin/toastui/*',
        'package-lock.json'
    ]
    return pathspec.PathSpec.from_lines('gitwildmatch', internal_patterns)

def concatenate_files(output_file):
    """Concatenate all specified files in parent directory, excluding .gitignore and internal ignore patterns."""
    # Change to parent directory
    os.chdir(Path.cwd().parent)
    project_dir = Path.cwd()  # Use current working directory (after changing to parent)
    gitignore_path = project_dir / '.gitignore'
    gitignore_spec = load_gitignore_patterns(gitignore_path)
    internal_ignore_spec = load_internal_ignore_patterns()
    
    # Define file extensions to include
    extensions = {'.js', '.css', '.html', '.cjs', '.json'}
    
    output = []
    
    # Walk through directory
    for root, _, files in os.walk(project_dir):
        root_path = Path(root)
        for filename in files:
            file_path = root_path / filename
            # Check if file has desired extension
            if file_path.suffix.lower() in extensions:
                # Get relative path from project directory
                rel_path = file_path.relative_to(project_dir)
                # Check if file is ignored by .gitignore or internal ignore patterns
                if not (gitignore_spec.match_file(rel_path) or internal_ignore_spec.match_file(rel_path)):
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            content = f.read()
                        # Format output: -----<filepath><filename>----\n\n<filecontent>\n\n\n\n
                        output.append(f"-----{rel_path}----\n\n{content}\n\n\n\n")
                    except Exception as e:
                        print(f"Error reading {rel_path}: {e}")
    
    # Write concatenated content to output file
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(''.join(output))
        print(f"Output written to {output_file}")
    except Exception as e:
        print(f"Error writing to {output_file}: {e}")

if __name__ == '__main__':
    import sys
    
    if len(sys.argv) != 2:
        print("Usage: python concat_files.py <output_filename>")
        sys.exit(1)
    
    output_filename = sys.argv[1]
    concatenate_files(output_filename)