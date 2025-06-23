let
  pkgs = import <nixpkgs> {};
in pkgs.mkShell {
  packages = [
    pkgs.nodejs
    pkgs.web-ext
  ];
  #shellHook = ''
  #  source .venv/bin/activate
  #'';
}