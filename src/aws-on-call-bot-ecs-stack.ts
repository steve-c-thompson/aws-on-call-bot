import * as cdk from "@aws-cdk/core";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as ecs from "@aws-cdk/aws-ecs";
import {
  AwsLogDriverMode,
  Ec2TaskDefinition,
  NetworkMode,
} from "@aws-cdk/aws-ecs";
import * as path from "path";
import * as ecrdeploy from "cdk-ecr-deployment";

import { AddCapacityOptions } from "@aws-cdk/aws-ecs/lib/cluster";
import { KeyPair } from "cdk-ec2-key-pair";
import { buildPublicVpc, buildSecrets } from "./utils/utils";
import { Repository } from "@aws-cdk/aws-ecr";
import { DockerImageAsset } from "@aws-cdk/aws-ecr-assets";
import { RetentionDays } from "@aws-cdk/aws-logs";

export class AwsOnCallBotEcsStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create new VPC
    const vpc = buildPublicVpc(this, "on-call-ecs-vpc");

    // Open port 22 for SSH connection from anywhere
    const securityGroup = new ec2.SecurityGroup(this, "SecurityGroup", {
      vpc,
      securityGroupName: "on-call-bot-ecs-sg",
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
      // needed to make ec2 instances accessible by IP address
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      keyName: key.keyPairName,
    };

    const secrets = buildSecrets(this);

    const repository = new Repository(this, "OnCallBotRepo", {
      imageScanOnPush: true,
    });

    // Docker image
    const imageName = "on-call-bot";
    const asset = new DockerImageAsset(this, "CDKDockerImage", {
      directory: path.relative(__dirname, imageName),
    });

    new ecrdeploy.ECRDeployment(this, "DeployDockerImage", {
      src: new ecrdeploy.DockerImageName(asset.imageUri),
      dest: new ecrdeploy.DockerImageName(
        // `${cdk.Aws.ACCOUNT_ID}.dkr.ecr.${cdk.Aws.REGION}.amazonaws.com/${imageName}`
        repository.repositoryUri
      ),
    });

    const ec2Task: Ec2TaskDefinition = new Ec2TaskDefinition(this, "ec2-task", {
      networkMode: NetworkMode.AWS_VPC,
    });

    const container = ec2Task.addContainer("defaultContainer", {
      // fromDockerImageAsset does not work with ECRDeployment
      // image: ecs.ContainerImage.fromDockerImageAsset(asset),
      // image: ecs.EcrImage.fromDockerImageAsset(asset),
      // image: ecs.RepositoryImage.fromDockerImageAsset(asset),

      // Works when repository used
      image: ecs.ContainerImage.fromEcrRepository(repository),
      // image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample"),

      memoryLimitMiB: 256,
      secrets: secrets,
      portMappings: [{ containerPort: 3000, hostPort: 3000 }],
      logging: new ecs.AwsLogDriver({
        streamPrefix: "OnCallBotStr",
        mode: AwsLogDriverMode.NON_BLOCKING,
        logRetention: RetentionDays.ONE_DAY,
      }),
    });

    // Create an ECS cluster
    // Adding Capacity with deprecated method because cluster.connections.addSecurityGroup does not work
    const cluster = new ecs.Cluster(this, "BotCluster", {
      vpc: vpc,
      //capacity: ec2Capacity,
    });

    //cluster.connections.addSecurityGroup(securityGroup);

    cluster
      .addCapacity("BotClusterCapacity", ec2Capacity)
      .addSecurityGroup(securityGroup);

    // Instantiate an Amazon ECS Service
    const ecsService = new ecs.Ec2Service(this, "BotService", {
      cluster: cluster,
      taskDefinition: ec2Task,
      securityGroups: [securityGroup],
    });

    // Create outputs for connecting
    new cdk.CfnOutput(this, "Cluster ARN", { value: cluster.clusterArn });
    new cdk.CfnOutput(this, "Key Name", { value: key.keyPairName });
    new cdk.CfnOutput(this, "Download Key Command", {
      value:
        "aws [--profile username] secretsmanager get-secret-value --secret-id ec2-ssh-key/cdk-keypair/private --query SecretString --output text > cdk-key.pem && chmod 400 cdk-key.pem",
    });
    new cdk.CfnOutput(this, "ssh command", {
      value:
        "ssh -i cdk-key.pem -o IdentitiesOnly=yes ec2-user@" +
        "   ...find IP at https://console.aws.amazon.com/ecs/",
    });
  }
}
