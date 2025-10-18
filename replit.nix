{ pkgs }: {
  deps = [
    pkgs.nodejs_20  # <-- Changed hyphen to underscore
    pkgs.chromium
  ];
}