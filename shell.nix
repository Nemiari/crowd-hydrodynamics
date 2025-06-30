{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
	packages = (with pkgs; [
		nodejs
		opencv
	] ++ (with python313Packages; [
		opencv-python
		numpy
	]));

	shellHook = ''
		if [ ! -d "node_modules" ]; then
			echo "installing required packages..."
			npm install
		fi

    npm run dev
	'';
}
