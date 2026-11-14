{
  inputs = {
    nixpkgs.url = "https://channels.nixos.org/nixos-unstable/nixexprs.tar.zst";
  };

  outputs = {nixpkgs, ...}: let
    pkgs = nixpkgs.legacyPackages."x86_64-linux";
  in {
    devShells.x86_64-linux.default = pkgs.mkShell {
      buildInputs = with pkgs; [
        prisma-engines
        prisma
      ];
      shellHook = ''
        export PKG_CONFIG_PATH="${pkgs.openssl.dev}/lib/pkgconfig";
        export PRISMA_SCHEMA_ENGINE_BINARY="${pkgs.prisma-engines}/bin/schema-engine"
        export PRISMA_QUERY_ENGINE_BINARY="${pkgs.prisma-engines}/bin/query-engine"
        export PRISMA_FMT_BINARY="${pkgs.prisma-engines}/bin/prisma-fmt"
      '';

      packages = with pkgs; [
        nodejs_26
        pnpm
        git
        python3
      ];

      env = {
        pnpm_config_runtime = "false";
        pnpm_config_verify_deps_before_run = "false";
      };
    };
  };
}
