# Claimed Idenity Collector

Claimed identity collector

## How to run tests

To run all tests, run `yarn test:unit`. This will compile and run all tests in the `/tests` directory.

### How to perform lint checks an individual test file

To check if there are any linting issues, run `yarn lint`. If there are any critical errors, this command 
will fail prompting developer to fix those issues. The report will be present under `reports` folder as an
html file. Once those critical errors are fixed, re running `yarn lint` should not return any errors.
In order to fix some simple formatting issues, one can run `yarn lint:fix` which should fix most of those automatically.
