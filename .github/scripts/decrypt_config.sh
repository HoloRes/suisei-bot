#!/bin/sh

# Decrypt the file
gpg --quiet --batch --yes --decrypt --passphrase="$GPG_KEY" \
--output config.json config.json.gpg
# --batch to prevent interactive command
# --yes to assume "yes" for questions