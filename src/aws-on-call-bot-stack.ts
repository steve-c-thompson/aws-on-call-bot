import * as cdk from '@aws-cdk/core';
import * as ec2 from "@aws-cdk/aws-ec2";
import { KeyPair } from 'cdk-ec2-key-pair';
import * as iam from '@aws-cdk/aws-iam'
import * as path from 'path';
import { Asset } from '@aws-cdk/aws-s3-assets';
import {readFileSync} from "fs";

export class AwsOnCallBotStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    // The code that defines your stack goes here

    // Create a Key Pair to be used with this EC2 Instance
    const key = new KeyPair(this, 'KeyPair', {
      name: 'cdk-keypair',
      description: 'Key Pair created with CDK Deployment',
    });
    key.grantReadOnPublicKey

    // Create new VPC
    const vpc = new ec2.Vpc(this, 'on-call-cdk-vpc', {
      natGateways: 0,
      subnetConfiguration: [{
        cidrMask: 24,
        name: "public",
        subnetType: ec2.SubnetType.PUBLIC
      }]});

    // Open port 22 for SSH connection from anywhere
    const securityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', {
      vpc,
      securityGroupName: "on-call-bot-sg",
      description: 'Allow ssh access to ec2 instances from anywhere',
      allowAllOutbound: true
    });
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'allow public ssh access')
    securityGroup.addIngressRule(
        ec2.Peer.anyIpv4(),
        ec2.Port.tcp(3100),
        'allow HTTP traffic to port 3100 for bot node js',
    );

    const role = new iam.Role(this, 'ec2Role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3ReadOnlyAccess'),
      ],
    })

    // role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'))

    // Latest AMAZON LINUX AMI
    const ami = new ec2.AmazonLinuxImage({ generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2 });

    // Instance details
    const ec2Instance = new ec2.Instance(this, 'On-Call Bot', {
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.NANO),
      machineImage: ami,
      securityGroup: securityGroup
    });

    // Create an asset that will be used as part of User Data to run on first load
    // const asset = new Asset(this, 'Asset', { path: path.join(__dirname, '../src/config.sh') });
    // const localPath = ec2Instance.userData.addS3DownloadCommand({
    //     bucket: asset.bucket,
    //     bucketKey: asset.s3ObjectKey,
    // });
    //
    // ec2Instance.userData.addExecuteFileCommand({
    //     filePath: localPath,
    //     arguments: '--verbose -y'
    // });
    // asset.grantRead(ec2Instance.role);

    const userDataScript = readFileSync('./lib/user-data.sh', 'utf8');
    ec2Instance.addUserData(userDataScript);

    // Create outputs for connecting
    new cdk.CfnOutput(this, 'IP Address', { value: ec2Instance.instancePublicIp });
    new cdk.CfnOutput(this, 'Key Name', { value: key.keyPairName })
    new cdk.CfnOutput(this, 'Download Key Command', { value: 'aws secretsmanager get-secret-value --secret-id ec2-ssh-key/cdk-keypair/private --query SecretString --output text > cdk-key.pem && chmod 400 cdk-key.pem' })
    new cdk.CfnOutput(this, 'ssh command', { value: 'ssh -i cdk-key.pem -o IdentitiesOnly=yes ec2-user@' + ec2Instance.instancePublicIp })

  }
}
