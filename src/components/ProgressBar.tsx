import React, { useState, useEffect, ReactElement } from 'react';
import styled from 'styled-components';

interface ProgressDivProps {
  width: number;
}

interface ProgressProps {
  progress: number;
}

const ProgressDiv = styled.div<ProgressDivProps>`
  background-color: rgb(233, 233, 233);
  border-radius: .5rem;
  width: ${(props) => props.width}px
`;

const Progress = styled.div<ProgressProps>`
  background-color: rgb(62, 122, 235);
  height: 10px;
  border-radius: 1rem;
  transition: 1s ease;
  transition-delay: 0.5s;
  width: ${(props) => props.progress}px
`;

type ProgressBarProps = {
  width: number;
  percent: number;
};

export default function ProgressBar({ width, percent }: ProgressBarProps): ReactElement {
  const [value, setValue] = useState(0);

  useEffect(() => {
    setValue(percent * width);
  }, [percent, width]);
  return (
    <ProgressDiv width={width}>
      <Progress progress={value} />
    </ProgressDiv>
  );
}
