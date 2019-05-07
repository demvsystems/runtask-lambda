var AWS = require('aws-sdk');
var ecs = new AWS.ECS();
const codedeploy = new AWS.CodeDeploy({apiVersion: '2014-10-06'});

exports.handler = (events, context, callback) => {
    console.log(events);
    var deploymentId = events.DeploymentId;
    var lifecycleEventHookExecutionId = events.LifecycleEventHookExecutionId;

    var params = {
        taskDefinition: process.env.TASK_DEFINITION,
        count: 1,
        launchType: 'FARGATE',
        cluster: process.env.CLUSTER_NAME,
        overrides: {
            containerOverrides: [{
                name: process.env.CONTAINER_NAME,
                command: process.env.COMMAND.split(' ')
            }]
        },
        networkConfiguration: {
            awsvpcConfiguration: {
                subnets: process.env.SUBNETS.split(','),
                assignPublicIp: 'ENABLED',
                securityGroups: process.env.SECURITY_GROUPS.split(','),
            }
        },
    };
    var status = 'Failed';
    ecs.runTask(params, function(err, data) {
        if (err) console.log(err, err.stack); // an error occurred
        else {
            console.log(data);
            status = 'Succeeded';
        }
        context.done(err, data);
    });

    var statusparams = {
        deploymentId: deploymentId,
        lifecycleEventHookExecutionId: lifecycleEventHookExecutionId,
        status: status // status can be 'Succeeded' or 'Failed'
    };

    // Pass AWS CodeDeploy the prepared validation test results.
    codedeploy.putLifecycleEventHookExecutionStatus(statusparams, function(err, data) {
        if (err) {
            // Migration failed.
            callback('Migration Failed');
        } else {
            // Migration succeeded.
            callback(null, 'Migration succeeded');
        }
    });
};
