#!/usr/bin/env python3
"""
Update the version number to force cache bust
"""

def update_version():
    version_file = "/home/mediacms.io/mediacms/cms/version.py"
    
    print("🔧 Updating version number to force cache bust...")
    
    # Write the new version
    with open(version_file, 'w') as f:
        f.write('VERSION = "6.6.1"\n')
    
    print("✅ Successfully updated version to 6.6.1")
    return True

if __name__ == "__main__":
    update_version()

