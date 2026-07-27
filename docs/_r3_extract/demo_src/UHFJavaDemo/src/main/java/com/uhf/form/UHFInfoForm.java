/*
 * Created by JFormDesigner on Mon Oct 17 17:19:48 CST 2022
 */

package com.uhf.form;

import com.uhf.UHFMainForm;

import java.awt.*;
import java.awt.event.*;
import javax.accessibility.AccessibleContext;
import javax.swing.*;
import javax.swing.plaf.PanelUI;

/**
 * @author zp
 */
public class UHFInfoForm extends JPanel {
    public UHFInfoForm() {
        initComponents();
        if(UHFMainForm.isEnglish()){
            label1.setText("UHF Version:");
        }
    }

    @Override
    public void setVisible(boolean aFlag) {
        super.setVisible(aFlag);
        if (aFlag) {
            String version = UHFMainForm.uhf.getVersion();
            uhfVersion.setText(version);
        }
    }

    private void initComponents() {
        // JFormDesigner - Component initialization - DO NOT MODIFY  //GEN-BEGIN:initComponents
        uhfVersion = new JLabel();
        label1 = new JLabel();

        //======== this ========
        setLayout(null);

        //---- uhfVersion ----
        uhfVersion.setFont(uhfVersion.getFont().deriveFont(uhfVersion.getFont().getSize() + 5f));
        add(uhfVersion);
        uhfVersion.setBounds(155, 40, 390, 25);

        //---- label1 ----
        label1.setText("UHF\u56fa\u4ef6\u7248\u672c\uff1a");
        label1.setFont(label1.getFont().deriveFont(label1.getFont().getSize() + 5f));
        add(label1);
        label1.setBounds(new Rectangle(new Point(35, 40), label1.getPreferredSize()));

        {
            // compute preferred size
            Dimension preferredSize = new Dimension();
            for(int i = 0; i < getComponentCount(); i++) {
                Rectangle bounds = getComponent(i).getBounds();
                preferredSize.width = Math.max(bounds.x + bounds.width, preferredSize.width);
                preferredSize.height = Math.max(bounds.y + bounds.height, preferredSize.height);
            }
            Insets insets = getInsets();
            preferredSize.width += insets.right;
            preferredSize.height += insets.bottom;
            setMinimumSize(preferredSize);
            setPreferredSize(preferredSize);
        }
        // JFormDesigner - End of component initialization  //GEN-END:initComponents
    }

    // JFormDesigner - Variables declaration - DO NOT MODIFY  //GEN-BEGIN:variables
    private JLabel uhfVersion;
    private JLabel label1;
    // JFormDesigner - End of variables declaration  //GEN-END:variables
}
