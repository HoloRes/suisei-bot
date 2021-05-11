#!/bin/bash -ex

echo "Configuring Tower Settings"
hostval=$(tower-cli config host $TOWER_HOST)
userval=$(tower-cli config username $TOWER_USERNAME)
passwordval=$(tower-cli config password $TOWER_PASSWORD)

if [[ $userval == "username: " ]] || [[ $passwordval == "password: " ]]
then
  echo "WARNING: Configuration has not been fully set";
  echo "   You will want to run the $ tower-cli config ";
  echo "   command for host, username, and password ";
fi

tower-cli job launch --job-template $TOWER_JOB_ID --monitor