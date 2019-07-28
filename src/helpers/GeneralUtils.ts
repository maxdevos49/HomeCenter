import { config } from "../config";
import { Response } from "express";
import nodemailer from "nodemailer";
import fileModel from "../models/fileModel";
import userModel from "../models/userModel";
import { View } from "./vash/view";
import { ErrorViewModel } from "../viewModels/errorViewModel";

export class GeneralUtils {

    public static async sendEmail(email: IEmail): Promise<string> {

        let account = { user: "", pass: "" }

        if (config.server.environment === "development") {
            account = await nodemailer.createTestAccount();
        } else {
            account = {
                user: config.email.username,
                pass: config.email.password
            }
        }

        let transporter = nodemailer.createTransport({
            host: "smtp.ethereal.email",
            port: 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: account.user,
                pass: account.pass
            }
        });

        // send mail with defined transport object
        let info = await transporter.sendMail({
            from: config.email.from,
            to: email.to,
            subject: email.subject,
            html: email.body
        });

        if (config.server.environment === "development" || "localhost") {
            console.log("Message sent: %s", info.messageId);
            console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
            return "Preview URL: %s" + nodemailer.getTestMessageUrl(info);
        }

        return null;
    }

    public static sendErrorNotification(res: Response, error: string): void {
        let info = GeneralUtils.sendEmail({
            to: [config.email.errorNotificationEmail],
            subject: "Error in ThatOneSpot",
            body: error + "</br></br>" + GeneralUtils.getBrowserInfo(res)
        });

        return res.render("Shared/error", View(res, ErrorViewModel, { error: error, browserInfo: GeneralUtils.getBrowserInfo(res), emailInfo: info }))
    }

    public static getBrowserInfo(res: Response): string {

        const ua = res.req.useragent;

        return `
            IsMobile: ${ua.isMobile}<br/>
            IsDesktop: ${ua.isDesktop}<br/>
            IsBot: ${ua.isBot}<br/>
            Browser: ${ua.browser}<br/>
            Version: ${ua.version}<br/>
            OS: ${ua.os}<br/>
            Platform: ${ua.platform}</br>
            Source: ${ua.source}`;
    }

    /**
     * Method designed to escape html in a string
     * @param text
     * @returns an escaped string
     */
    public static escapeHtml(text: string): string {
        let map: any = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return text.replace(/[&<>"']/g, function (m) {
            return map[m];
        });
    }

    private static getFileExtension(file: string): string {
        let ext = file.split(".");

        if (ext.length === 1 || (ext[0] === "" && ext.length === 2)) {
            return "";
        }
        return ext.pop();
    }

    public static async UploadFiles(options: IFileUploadConfig): Promise<string[]> {

        let resultIds: string[] = [];
        let files: any[] = [];

        //make sure we always have an array
        if (!Array.isArray(options.files)) {
            //means we have only 1 file
            files.push(options.files);
        } else {
            files = options.files;
        }

        //validate file count
        if (options.limit < files.length) {
            throw new Error(`Invalid file amount. Expected a maximum of ${options.limit} files but recieved ${files.length}`);
        }

        //check each files type
        for (let i = 0; i < files.length; i++) {
            if (!options.accept.includes(files[i].mimetype)) {
                throw new Error(`File type of ${files[i].mimetype} is not allowed.`);
            }
        }

        //Process all files
        for (let i = 0; i < files.length; i++) {

            //create db object to track file
            let newFile = new fileModel({
                name: files[i].name,
                isActive: true,
                CreatedOn: Date.now()
            });

            try {
                let filedata = await newFile.save();

                //get extension
                let fileName = `${filedata._id}.${GeneralUtils.getFileExtension(files[i].name)}`;

                //add to the results
                resultIds.push(fileName);

                //move and rename file
                files[i].mv(`${config.path}/public/uploads/${fileName}`, (err1: any) => {
                    if (err1) throw err1;
                });

            } catch (err) {
                //probably do something here someday
                throw err;
            }
        }

        return resultIds;
    }

    public static async DeactivateFiles(files: string[]): Promise<void> {
        if (files.length > 0) {

            await fileModel.updateMany(
                {
                    _id: {
                        $in: files.filter(x => typeof x == "string").map(x => x.split(".")[0])
                    }
                },
                {
                    $set: {
                        isActive: false
                    }
                });
        }
    }

    public static GetLoggedInUserId(res: Response): string {
        return res.locals.authentication.id;
    }

    public static GetLoggedInUserName(res: Response): string {
        return res.locals.authentication.given_name + " " + res.locals.authentication.family_name;
    }

    public static IsLocalhost() {
        return (config.server.environment === "localhost");
    }

    public static async GetNameById(id: string): Promise<string> {

        let userData: any = await userModel.findById(id);

        if (!userData) {
            return "";
        }

        return userData.firstname + " " + userData.lastname;
    }

    public static AddModelError(res: Response, message: string): void {
        res.locals.validation.push({ message: message });
    }
}


interface IFileUploadConfig {
    files: any,

    limit: number,

    accept: string[]
}

export interface IEmail {
    to: string[];
    subject: string;
    body: string;
}