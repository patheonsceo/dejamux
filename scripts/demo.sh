#!/bin/bash
# DEJA Demo Script - Full Feature Showcase
# This script demonstrates all DEJA capabilities

set -e

CLI="/home/dev/Projects/deja-cli/dist/cli.js"
DEMO_DIR="/tmp/deja-demo-showcase"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_header() {
    echo ""
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_command() {
    echo -e "${YELLOW}$ $1${NC}"
    sleep 0.5
}

# Clean start
rm -rf "$DEMO_DIR"
mkdir -p "$DEMO_DIR"
cd "$DEMO_DIR"

# Initialize git
git init -q
git config user.email "demo@test.com"
git config user.name "Demo User"

print_header "DEJA CLI Demo - Multi-agent Context Management"

echo "Welcome to DEJA - the universal memory layer for AI coding tools."
echo "This demo showcases the core features."
echo ""

# 1. Initialize
print_header "1. Initializing DEJA"
print_command "deja init"
echo "1" | node "$CLI" init 2>/dev/null

# 2. Start session
print_header "2. Starting a Coding Session"
print_command "deja start"
node "$CLI" start

# 3. Simulate coding
print_header "3. Simulating Development Work"
echo "Creating project structure..."

mkdir -p src/components src/api src/utils
cat > src/api/auth.ts << 'EOF'
import { hash, verify } from '../utils/crypto';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
}

export async function login(email: string, password: string): Promise<User | null> {
  // Implementation
  return null;
}

export async function register(email: string, password: string): Promise<User> {
  const passwordHash = await hash(password);
  return { id: crypto.randomUUID(), email, passwordHash };
}
EOF

cat > src/components/LoginForm.tsx << 'EOF'
import React, { useState } from 'react';
import { login } from '../api/auth';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(email, password);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input value={email} onChange={e => setEmail(e.target.value)} />
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
      <button type="submit">Login</button>
    </form>
  );
}
EOF

cat > src/utils/crypto.ts << 'EOF'
export async function hash(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
}

export async function verify(input: string, hash: string): Promise<boolean> {
  return await this.hash(input) === hash;
}
EOF

git add -A
echo -e "${GREEN}✓ Created 3 new files${NC}"

# 4. Add notes
print_header "4. Adding Development Notes"
print_command 'deja note "Implemented user authentication with SHA-256 hashing"'
node "$CLI" note "Implemented user authentication with SHA-256 hashing"

print_command 'deja note "Decision: Using React hooks for form state management"'
node "$CLI" note "Decision: Using React hooks for form state management"

# 5. Check status
print_header "5. Checking Session Status"
print_command "deja status"
node "$CLI" status

# 6. Stop session
print_header "6. Stopping Session & Compiling Context"
print_command "deja stop"
node "$CLI" stop

# 7. View session log
print_header "7. Viewing Session History"
print_command "deja log"
node "$CLI" log

# 8. Search functionality
print_header "8. Searching Sessions"
print_command 'deja search "auth"'
node "$CLI" search "auth"

# 9. View compiled context
print_header "9. Generated Context Files"
echo -e "${GREEN}Generated files for AI tools:${NC}"
echo ""
for file in .cursorrules CLAUDE.md .github/copilot-instructions.md .windsurfrules; do
    if [ -f "$file" ]; then
        size=$(wc -c < "$file")
        echo -e "  ${CYAN}✓${NC} $file (${size} bytes)"
    fi
done

echo ""
echo -e "${YELLOW}Content of CLAUDE.md:${NC}"
echo "─────────────────────────────────────────────────"
cat CLAUDE.md
echo "─────────────────────────────────────────────────"

# 10. Show mux help
print_header "10. Multi-Agent Terminal (deja mux)"
print_command "deja mux --help"
node "$CLI" mux --help

print_header "Demo Complete!"
echo "DEJA automatically:"
echo "  • Tracked 3 file changes"
echo "  • Captured 2 developer notes"
echo "  • Compiled context for 4 AI tools"
echo "  • Created searchable session history"
echo ""
echo "Run 'deja mux start' to launch the multi-agent terminal!"
echo ""
