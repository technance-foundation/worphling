set dotenv-load

# Clean build artifacts and caches
clean:
	find . \( -name 'node_modules' -o -name '.pnpm' -o -name '.turbo' -o -name 'build' -o -name '.next' -o -name '.cache' -o -name 'dist' \) -type d -prune -print -exec rm -rf '{}' \;
	find . -type f -name 'tsconfig.tsbuildinfo' -exec rm -f {} +

# Clean all build artifacts and caches and reinstall dependencies
fresh: clean
	pnpm install

# Install dependencies
install:
	pnpm install

# Install dependencies and run playground app
playground: install
	pnpm playground