import os
import zipfile
import argparse
import shutil
from pathlib import Path

def create_bridge_package(workspace_dir, history_file, memory_file, output_zip):
    print(f"🚀 Initializing AI-Bridge Packager...")
    
    # Create a temporary staging directory
    staging_dir = Path("ai_bridge_staging")
    staging_dir.mkdir(exist_ok=True)
    
    context_dir = staging_dir / "context"
    context_dir.mkdir(exist_ok=True)
    
    workspace_staging = staging_dir / "workspace"
    workspace_staging.mkdir(exist_ok=True)
    
    # 1. Copy history and memory
    if history_file and Path(history_file).exists():
        shutil.copy(history_file, context_dir / "chat_history.txt")
        print("✅ Added Chat History")
        
    if memory_file and Path(memory_file).exists():
        shutil.copy(memory_file, context_dir / "memory.md")
        print("✅ Added AI Memory/Preferences")
        
    # 2. Copy workspace files
    if workspace_dir and Path(workspace_dir).exists():
        for item in Path(workspace_dir).iterdir():
            if item.is_dir():
                shutil.copytree(item, workspace_staging / item.name, dirs_exist_ok=True)
            else:
                shutil.copy(item, workspace_staging / item.name)
        print(f"✅ Added Workspace Files from {workspace_dir}")
        
    # 3. Add the Mega-Prompt
    bootstrap_source = Path("bootstrap_prompt.md")
    if bootstrap_source.exists():
        shutil.copy(bootstrap_source, staging_dir / "00_READ_ME_FIRST.md")
        print("✅ Added Bootstrap Mega-Prompt")
        
    # 4. Zip it all up
    print(f"📦 Packaging into {output_zip}...")
    with zipfile.ZipFile(output_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(staging_dir):
            for file in files:
                file_path = Path(root) / file
                archive_path = file_path.relative_to(staging_dir)
                zipf.write(file_path, archive_path)
                
    # Cleanup staging
    shutil.rmtree(staging_dir)
    print(f"🎉 AI-Bridge package created successfully: {output_zip}")
    print(f"👉 Upload this ZIP file to the new AI (Claude/ChatGPT/Gemini) and tell it to read '00_READ_ME_FIRST.md'")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='AI-Bridge Context Packager')
    parser.add_argument('--workspace', type=str, help='Path to the project code folder', default='.')
    parser.add_argument('--history', type=str, help='Path to chat history text file', default='')
    parser.add_argument('--memory', type=str, help='Path to memory/rules markdown file', default='')
    parser.add_argument('--output', type=str, help='Output ZIP file name', default='AI_Bridge_Export.zip')
    
    args = parser.parse_args()
    create_bridge_package(args.workspace, args.history, args.memory, args.output)
