import json, os

severities = {
    0: 'LOW',
    1: 'MEDIUM',
    2: 'HIGH'
}

with open('eslint.out') as eslint_output:
    # The error and warning counts are reported per-file, so lets aggregate them across files
    total_error_count = 0
    total_warning_count = 0
    annotations = []
    for file in json.load(eslint_output):
        total_error_count += file['errorCount']
        total_warning_count += file['warningCount']
        # The path is absolute, but Bitbucket Server requires it to be relative to the git repository
        relativePath = file['filePath'].replace(os.getcwd() + '/', '')
        for message in file['messages']:
            annotations.append({
                'path': relativePath,
                'line': message['line'],
                'message': message['message'],
                'severity': severities[message['severity']]
            })

    with open('report.json', 'w') as report_file:
        report = {
            'title': 'ESLint report',
            'vendor': 'ESLint',
            'logoUrl': 'https://eslint.org/img/logo.svg',
            'data': [
                {
                    'title': 'Error Count',
                    'value': total_error_count
                },
                {
                    'title': 'Warning Count',
                    'value': total_warning_count
                }
            ]
        }
        # Write the report json to file
        json.dump(report, report_file)

    with open('annotations.json', 'w') as annotation_file:
        # Write the annotations json to file
        json.dump({'annotations': annotations}, annotation_file)