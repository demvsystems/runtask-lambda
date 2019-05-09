# RunTask Lambda

## Introduction
This lambda function executes in ECS Fargate Tasks and is configured with
different container overrides. It is designed to be a Hook in an ECS
CodeDeploy.

## Configuration
There are six environment variables that must be set. See the
[.env.dist](https://github.com/demvsystems/runtask-lambda/blob/master/.env.dist)
file for the exact keys.

Variable | Definition
---------|-----------
`TASK_DEFINITION`| The name of the task definition, which will be run.
`CLUSTER_NAME` | The name of the ECS Cluster, where the task should be started.
`COMMAND` | The command override which will be executed by the task. Commands are written as a normal string. For example: `php -v`. The lambda translates the string to the container override format of AWS.
`CONTAINER_NAME` | The name of the container for which the command will be overwritten.
`SUBNETS` | A comma separated string of subnet IDs belonging to a VPC, where the task will be spawned in. Example: `subnet-1,subnet-2,subnet-3`
`SECURITY_GROUPS` | A comma separated string of security group IDs belonging to the VPC, where the task will be spawned in. Example: `sg-1,sg-2`

## Infrastructure
In this part we present a minimal infrastructure, which is needed by the lambda. The
infrastructure is presented as a terraform script.

```hcl
// Allow Lambda to assume a role
data "aws_iam_policy_document" "assume_by_lambda" {
  statement {
    sid     = "AllowAssumeByLambda"
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "this" {
  name               = "RunTaskLambdaRole"
  assume_role_policy = "${data.aws_iam_policy_document.assume_by_lambda.json}"
}

// Allow the lambda function to report back its result to codedeploy
data "aws_iam_policy_document" "this" {
  statement {
    sid    = "AllowPutLifecycleEventHookExecutionStatus"
    effect = "Allow"

    actions = ["codedeploy:PutLifecycleEventHookExecutionStatus"]
    resources = ["<my codedeploy arn>"]
  }
}

resource "aws_iam_role_policy" "this" {
  policy = "${data.aws_iam_policy_document.this.json}"
  role   = "${aws_iam_role.this.id}"
}

// The Runtask Lambda. Here the ZIP file is provided by the
// local machine. It can also be provided by other filesystems (like S3)
resource "aws_lambda_function" "this" {
  filename          = "runtask-lambda.zip"
  function_name     = "runtask-lambda"
  handler           = "exports.handler" // This Handler is always the same
  runtime           = "nodejs8.10"
  role              = "${aws_iam_role.this.arn}"

  environment {
    variables {
      TASK_DEFINITION = "arn:aws:ecs:<current zone>:<current account id>:task-definition/<task definition name>"
      CLUSTER_NAME    = "arn:aws:ecs:<current zone>:<current account id>:cluster/<cluster name>"
      CONTAINER_NAME  = "<my container name>"
      COMMAND         = "php -v"
      SUBNETS         = "${join(",", <my subnet ids array>)}"
      SECURITY_GROUPS = "${join(",", <my security group ids array>)}"
    }
  }
}
```

This is a minimal working example to hook the lambda into a CodeDeploy. It is
important to also define the lambda function name as a hook in the
`appspec.yml` and give CodeDeploy the permission to trigger this lambda.
