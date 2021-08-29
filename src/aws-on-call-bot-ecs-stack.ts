import * as cdk from "@aws-cdk/core";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as ecs from "@aws-cdk/aws-ecs";
import { AddCapacityOptions } from "@aws-cdk/aws-ecs/lib/cluster";
import { Ec2TaskDefinition, Secret } from "@aws-cdk/aws-ecs";
import * as iam from "@aws-cdk/aws-iam";
import { KeyPair } from "cdk-ec2-key-pair";
import { buildPublicVpc, newEcsSecret, smSecretFromName } from "./utils/utils";
import { awsInfo } from "./utils/utils";
import { Secret as SmSecret } from "@aws-cdk/aws-secretsmanager/lib/secret";

export class AwsOnCallBotEcsStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create new VPC
    const vpc = buildPublicVpc(this, "on-call-cdk-vpc");

    // Open port 22 for SSH connection from anywhere
    const securityGroup = new ec2.SecurityGroup(this, "SecurityGroup", {
      vpc,
      securityGroupName: "on-call-bot-sg",
      description: "Allow ssh access to ec2 instances from anywhere",
      allowAllOutbound: true,
    });
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      "allow public ssh access"
    );
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(3000),
      "allow HTTP traffic to port 3000 for bot node js"
    );

    const key = new KeyPair(this, "KeyPair", {
      name: "cdk-keypair",
      description: "Key Pair created with CDK Deployment",
    });

    // Capacity
    const ec2Capacity: AddCapacityOptions = {
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T2,
        ec2.InstanceSize.MICRO
      ),
      maxCapacity: 1,
      minCapacity: 1,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      keyName: key.keyPairName,
    };
    // const secret = SmSecret.fromSecretPartialArn(
    //   this,
    //   awsInfo.getSecretName(),
    //   awsInfo.getSlackBotSecretArn()
    // );

    const secret = smSecretFromName(
      this,
      "oncall-bot-secret",
      awsInfo.getSecretName()
    );

    const role = new iam.Role(this, "OncallSecretReader", {
      assumedBy: new iam.AccountRootPrincipal(),
    });
    secret.grantRead(role);

    const secrets: Record<string, Secret> = {
      SLACK_SIGNING_SECRET: newEcsSecret(secret, "SLACK_SIGNING_SECRET"),
      SLACK_BOT_TOKEN: newEcsSecret(secret, "SLACK_BOT_TOKEN"),
      GOOGLE_SERVICE_ACCOUNT_EMAIL: newEcsSecret(
        secret,
        "GOOGLE_SERVICE_ACCOUNT_EMAIL"
      ),
      GOOGLE_PRIVATE_KEY: newEcsSecret(secret, "GOOGLE_PRIVATE_KEY"),
      SLACK_GOOGLE_SHEET_ID: newEcsSecret(secret, "SLACK_GOOGLE_SHEET_ID"),
    };

    const ec2Task: Ec2TaskDefinition = new Ec2TaskDefinition(this, "ec2-task");

    ec2Task.addContainer("defaultContainer", {
      image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample"),
      memoryLimitMiB: 512,
      secrets: secrets,
    });
    // Create an ECS cluster
    const cluster = new ecs.Cluster(this, "Cluster", {
      vpc,
      capacity: ec2Capacity,
    });

    // Instantiate an Amazon ECS Service
    const ecsService = new ecs.Ec2Service(this, "Service", {
      cluster: cluster,
      taskDefinition: ec2Task,
    });

    // Create outputs for connecting
    new cdk.CfnOutput(this, "Cluster ARN", { value: cluster.clusterArn });
    new cdk.CfnOutput(this, "Key Name", { value: key.keyPairName });
    new cdk.CfnOutput(this, "Download Key Command", {
      value:
        "aws secretsmanager get-secret-value --secret-id ec2-ssh-key/cdk-keypair/private --query SecretString --output text > cdk-key.pem && chmod 400 cdk-key.pem",
    });
    new cdk.CfnOutput(this, "ssh command", {
      value:
        "ssh -i cdk-key.pem -o IdentitiesOnly=yes ec2-user@" +
        "   ...find IP at https://console.aws.amazon.com/ecs/",
    });
  }
}
