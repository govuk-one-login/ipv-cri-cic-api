# WAF

This is a starter configuration for the WAF.

Please read the developer guide, as all WAFs should be deployed in Count mode, then upgraded to Block after testing.

https://docs.aws.amazon.com/waf/latest/developerguide/getting-started.html

## Simple use

To use this, simply comment out the rules that you no longer want to be in Count mode, and they'll follow the default action of their managed group.

Please read the documentation on AWS for the managed groups, and validate your key behaviours before running unsupervised in production.