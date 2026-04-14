#!/bin/bash
cd /Users/aaron/Developer/personal/ganengile-new

echo "Deploying App Hosting..."
firebase deploy --only apphosting:ganengile-admin --project ganengile

echo "Deploying Functions..."
firebase deploy --only functions --project ganengile
